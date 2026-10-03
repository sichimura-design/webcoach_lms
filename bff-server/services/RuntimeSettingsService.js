/**
 * Runtime Settings Service
 * 管理画面の「動作設定」: 設定値の一覧・Parameter Storeへの保存・ECSサービスの再起動
 *
 * 保存した値はコンテナの起動時に読み込まれるので、反映にはrestart()が要る。
 * Parameter Storeを使うのは本番だけで、dev/uatでは今の値を表示するだけ。
 */

const { GetParametersByPathCommand, PutParameterCommand, DeleteParameterCommand } = require('@aws-sdk/client-ssm');
const { DescribeServicesCommand, UpdateServiceCommand } = require('@aws-sdk/client-ecs');
const { getSsmClient, getEcsClient } = require('../config/clients');
const { config } = require('../config/environment');
const { RUNTIME_SETTINGS, toParameterKey } = require('../config/runtimeSettings');
const apiServerAdapter = require('../adapters/ApiServerAdapter');
const logger = require('../utils/logger');

class RuntimeSettingsService {
  isEditable() {
    return config.useParameterStore && !!config.bffParameterStorePrefix && !!config.apiParameterStorePrefix;
  }

  isRestartAvailable() {
    return !!config.ecsClusterName && !!config.ecsServiceName;
  }

  _prefix(service) {
    return service === 'api-server' ? config.apiParameterStorePrefix : config.bffParameterStorePrefix;
  }

  _parameterName(setting) {
    return `${this._prefix(setting.service)}/config/${toParameterKey(setting.name)}`;
  }

  /** Parameter Storeに保存されている値 { パラメータ名: 値 } */
  async _savedValues() {
    const saved = {};
    for (const prefix of [config.apiParameterStorePrefix, config.bffParameterStorePrefix]) {
      let nextToken;
      do {
        const res = await getSsmClient().send(new GetParametersByPathCommand({
          Path: `${prefix}/config`,
          Recursive: false,
          NextToken: nextToken,
        }));
        for (const p of res.Parameters || []) saved[p.Name] = p.Value;
        nextToken = res.NextToken;
      } while (nextToken);
    }
    return saved;
  }

  async _restartStatus() {
    if (!this.isRestartAvailable()) return { available: false };
    const res = await getEcsClient().send(new DescribeServicesCommand({
      cluster: config.ecsClusterName,
      services: [config.ecsServiceName],
    }));
    const service = (res.services || [])[0];
    if (!service) return { available: false };
    const deployments = service.deployments || [];
    return {
      available: true,
      inProgress: deployments.length > 1 || deployments.some((d) => d.rolloutState === 'IN_PROGRESS'),
      runningCount: service.runningCount,
      desiredCount: service.desiredCount,
    };
  }

  async list() {
    const editable = this.isEditable();

    let apiValues = null;
    try {
      apiValues = await apiServerAdapter.getRuntimeSettings();
    } catch (error) {
      logger.error('[RuntimeSettings] api-serverの現在値を取得できませんでした:', error.message);
    }

    const saved = editable ? await this._savedValues() : {};
    const restart = await this._restartStatus();

    const settings = RUNTIME_SETTINGS.map((setting) => {
      const current = setting.service === 'api-server'
        ? (apiValues && apiValues[setting.name] !== undefined ? apiValues[setting.name] : null)
        : setting.current();
      const savedRaw = editable ? saved[this._parameterName(setting)] : undefined;
      const savedValue = savedRaw === undefined ? null : Number(savedRaw);
      // 再起動したあとに使われる値。本番のタスク定義ではこれらを設定していないので、保存値か既定値になる
      const nextValue = savedValue === null ? setting.defaultValue : savedValue;
      return {
        name: setting.name,
        service: setting.service,
        group: setting.group,
        label: setting.label,
        description: setting.description,
        defaultValue: setting.defaultValue,
        min: setting.min,
        max: setting.max,
        current,
        saved: savedValue,
        pendingRestart: editable && current !== null && current !== nextValue,
      };
    });

    return { editable, restart, settings };
  }

  _find(name) {
    const setting = RUNTIME_SETTINGS.find((s) => s.name === name);
    if (!setting) {
      throw Object.assign(new Error('この設定は変更できません'), { statusCode: 404 });
    }
    return setting;
  }

  _assertEditable() {
    if (!this.isEditable()) {
      throw Object.assign(new Error('この環境では動作設定を画面から変更できません(本番のみ)'), { statusCode: 409 });
    }
  }

  async update(name, rawValue, actor) {
    this._assertEditable();
    const setting = this._find(name);
    const text = String(rawValue ?? '').trim();
    const value = Number(text);
    if (!/^\d+$/.test(text) || value < setting.min || value > setting.max) {
      throw Object.assign(
        new Error(`${setting.min}〜${setting.max}の整数で入力してください`),
        { statusCode: 400 }
      );
    }
    await getSsmClient().send(new PutParameterCommand({
      Name: this._parameterName(setting),
      Value: String(value),
      Type: 'String',
      Overwrite: true,
    }));
    logger.log(`[RuntimeSettings] ${actor} が ${setting.name} を ${value} に変更しました`);
  }

  /** 保存値を消して既定値に戻す */
  async reset(name, actor) {
    this._assertEditable();
    const setting = this._find(name);
    try {
      await getSsmClient().send(new DeleteParameterCommand({ Name: this._parameterName(setting) }));
    } catch (error) {
      if (error.name !== 'ParameterNotFound') throw error;
    }
    logger.log(`[RuntimeSettings] ${actor} が ${setting.name} を既定値に戻しました`);
  }

  /** ECSサービスを入れ替え起動して、保存した値を反映する(タスクを1つずつ入れ替える) */
  async restart(actor) {
    if (!this.isRestartAvailable()) {
      throw Object.assign(new Error('この環境では画面から再起動できません(本番のみ)'), { statusCode: 409 });
    }
    const status = await this._restartStatus();
    if (status.inProgress) {
      throw Object.assign(new Error('再起動中です。終わってからもう一度お試しください'), { statusCode: 409 });
    }
    await getEcsClient().send(new UpdateServiceCommand({
      cluster: config.ecsClusterName,
      service: config.ecsServiceName,
      forceNewDeployment: true,
    }));
    logger.log(`[RuntimeSettings] ${actor} がECSサービス ${config.ecsServiceName} を再起動しました`);
  }
}

module.exports = new RuntimeSettingsService();
