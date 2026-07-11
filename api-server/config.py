"""
Configuration Management Module

このモジュールは環境変数とParameter Storeの両方に対応します。
- ローカル開発: .envファイルから読み取り
- 本番環境: AWS Parameter Storeから読み取り

使い方:
    from config import get_config

    ANTHROPIC_API_KEY = get_config('ANTHROPIC_API_KEY')
"""

import os
import boto3
from functools import lru_cache
from typing import Optional

# Parameter Storeを使用するかどうか
USE_PARAMETER_STORE = os.getenv('USE_PARAMETER_STORE', 'false').lower() == 'true'
PARAMETER_STORE_PREFIX = os.getenv('PARAMETER_STORE_PREFIX', '/moodle/prod')

# SSM クライアント（Parameter Storeを使用する場合のみ初期化）
_ssm_client = None
if USE_PARAMETER_STORE:
    _ssm_client = boto3.client('ssm', region_name=os.getenv('AWS_REGION', 'ap-northeast-1'))

# 環境変数名とParameter Store パス名のマッピング
ENV_TO_PARAM_MAP = {
    # 機密情報
    'ANTHROPIC_API_KEY': f'{PARAMETER_STORE_PREFIX}/secrets/anthropic-api-key',
    'SESSION_SECRET': f'{PARAMETER_STORE_PREFIX}/secrets/session-secret',
    'CONTENT_TOKEN_SECRET': f'{PARAMETER_STORE_PREFIX}/secrets/content-token-secret',
    'INTERNAL_API_KEY': f'{PARAMETER_STORE_PREFIX}/secrets/internal-api-key',
    'MOODLE_SERVICE_PASSWORD': f'{PARAMETER_STORE_PREFIX}/secrets/moodle-service-password',
    'MOODLE_ADMIN_PASSWORD': f'{PARAMETER_STORE_PREFIX}/secrets/moodle-admin-password',
    'MOODLE_DB_PASSWORD': f'{PARAMETER_STORE_PREFIX}/secrets/db-password',

    # 設定値
    'PUBLIC_IP': f'{PARAMETER_STORE_PREFIX}/config/public-ip',
    'MOODLE_URL': f'{PARAMETER_STORE_PREFIX}/config/moodle-url',
    'API_SERVER_URL': f'{PARAMETER_STORE_PREFIX}/config/api-server-url',
    'NODE_ENV': f'{PARAMETER_STORE_PREFIX}/config/node-env',
    'ALLOWED_ORIGINS': f'{PARAMETER_STORE_PREFIX}/config/allowed-origins',
    'MOODLE_LANG': f'{PARAMETER_STORE_PREFIX}/config/moodle-lang',
    'MOODLE_SERVICE_USERNAME': f'{PARAMETER_STORE_PREFIX}/config/moodle-service-username',
    'MOODLE_SERVICE_NAME': f'{PARAMETER_STORE_PREFIX}/config/moodle-service-name',
    'COGNITO_USER_POOL_ID': f'{PARAMETER_STORE_PREFIX}/config/cognito-user-pool-id',
    'COGNITO_CLIENT_ID': f'{PARAMETER_STORE_PREFIX}/config/cognito-client-id',
    'COGNITO_REGION': f'{PARAMETER_STORE_PREFIX}/config/cognito-region',
    'S3_BUCKET_NAME': f'{PARAMETER_STORE_PREFIX}/config/s3-bucket-name',
    'CLOUDFRONT_DOMAIN': f'{PARAMETER_STORE_PREFIX}/config/cloudfront-domain',
    'VECTOR_DB_ENV': f'{PARAMETER_STORE_PREFIX}/config/vector-db-env',
    'FAISS_CACHE_DIR': f'{PARAMETER_STORE_PREFIX}/config/faiss-cache-dir',
    'AWS_REGION': f'{PARAMETER_STORE_PREFIX}/config/aws-region',
    'MOODLE_DB_HOST': f'{PARAMETER_STORE_PREFIX}/config/db-host',
    'MOODLE_DB_PORT': f'{PARAMETER_STORE_PREFIX}/config/db-port',
    'MOODLE_DB_USER': f'{PARAMETER_STORE_PREFIX}/config/db-user',
    'MOODLE_DB_NAME': f'{PARAMETER_STORE_PREFIX}/config/db-name',
    'MOODLE_ADMIN_USERNAME': f'{PARAMETER_STORE_PREFIX}/config/admin-username',
    'MOODLE_ADMIN_EMAIL': f'{PARAMETER_STORE_PREFIX}/config/admin-email',
    'MOODLE_SITE_NAME': f'{PARAMETER_STORE_PREFIX}/config/site-name',
}


@lru_cache(maxsize=128)
def _get_parameter_from_store(param_path: str) -> Optional[str]:
    """
    Parameter Storeから値を取得（キャッシュ付き）

    Args:
        param_path: Parameter Storeのパス

    Returns:
        パラメータの値、存在しない場合はNone
    """
    if not _ssm_client:
        return None

    try:
        response = _ssm_client.get_parameter(
            Name=param_path,
            WithDecryption=True  # SecureStringを復号化
        )
        return response['Parameter']['Value']
    except _ssm_client.exceptions.ParameterNotFound:
        print(f"Warning: Parameter not found: {param_path}")
        return None
    except Exception as e:
        print(f"Error fetching parameter {param_path}: {e}")
        return None


def get_config(env_var_name: str, default: Optional[str] = None) -> Optional[str]:
    """
    設定値を取得（環境変数 または Parameter Store）

    優先順位:
    1. 環境変数（既に設定されている場合）
    2. Parameter Store（USE_PARAMETER_STORE=true の場合）
    3. デフォルト値

    Args:
        env_var_name: 環境変数名
        default: デフォルト値

    Returns:
        設定値

    Examples:
        >>> get_config('ANTHROPIC_API_KEY')
        'sk-ant-api03-...'

        >>> get_config('PORT', '8001')
        '8001'
    """
    # 1. 環境変数を優先（ローカル開発用）
    env_value = os.getenv(env_var_name)
    if env_value:
        return env_value

    # 2. Parameter Storeから取得（本番環境用）
    if USE_PARAMETER_STORE and env_var_name in ENV_TO_PARAM_MAP:
        param_path = ENV_TO_PARAM_MAP[env_var_name]
        param_value = _get_parameter_from_store(param_path)
        if param_value:
            return param_value

    # 3. デフォルト値
    return default


def get_config_bool(env_var_name: str, default: bool = False) -> bool:
    """
    設定値をbooleanとして取得

    Args:
        env_var_name: 環境変数名
        default: デフォルト値

    Returns:
        boolean値
    """
    value = get_config(env_var_name)
    if value is None:
        return default
    return value.lower() in ('true', '1', 'yes', 'on')


def get_config_int(env_var_name: str, default: int = 0) -> int:
    """
    設定値をintegerとして取得

    Args:
        env_var_name: 環境変数名
        default: デフォルト値

    Returns:
        integer値
    """
    value = get_config(env_var_name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def get_config_float(env_var_name: str, default: float = 0.0) -> float:
    """
    設定値をfloatとして取得

    Args:
        env_var_name: 環境変数名
        default: デフォルト値

    Returns:
        float値
    """
    value = get_config(env_var_name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default


# AI/RAG関連の設定値
def get_rag_similarity_threshold() -> float:
    """
    RAG検索で参照元を返す類似度の閾値を取得

    デフォルト: 0.9 (90%)
    この値以上の類似度のソースのみを参照元として返します。

    Returns:
        類似度の閾値（0.0〜1.0）
    """
    return get_config_float('RAG_SIMILARITY_THRESHOLD', 0.9)


# 起動時に設定情報を表示
if __name__ != '__main__':
    print(f"Configuration Mode: {'Parameter Store' if USE_PARAMETER_STORE else 'Environment Variables'}")
    if USE_PARAMETER_STORE:
        print(f"Parameter Store Prefix: {PARAMETER_STORE_PREFIX}")
