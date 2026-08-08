<?php
/**
 * AWS Cognito カスタムヘルパークラス
 *
 * MoodleのOAuth2認証をCognitoに対応させるためのパッチ
 */

namespace auth_oauth2;

defined('MOODLE_INTERNAL') || die();

class cognito_helper {

    /**
     * Cognito JWTトークンからユーザー情報を取得
     *
     * @param string $jwt_token Cognito IDトークン
     * @return array|false ユーザー情報の連想配列、またはfalse
     */
    public static function get_user_info_from_jwt($jwt_token) {
        if (empty($jwt_token)) {
            return false;
        }

        // JWTトークンを分割（Header.Payload.Signature）
        $parts = explode('.', $jwt_token);
        if (count($parts) !== 3) {
            debugging('Invalid JWT token format', DEBUG_DEVELOPER);
            return false;
        }

        // Payloadをデコード
        $payload_encoded = $parts[1];

        // Base64 URLデコード
        $payload_json = self::base64_url_decode($payload_encoded);
        if (!$payload_json) {
            debugging('Failed to decode JWT payload', DEBUG_DEVELOPER);
            return false;
        }

        $payload = json_decode($payload_json, true);
        if (!$payload) {
            debugging('Failed to parse JWT payload JSON', DEBUG_DEVELOPER);
            return false;
        }

        // Cognitoのクレームをmoodleのユーザー情報にマッピング
        return [
            'username' => $payload['cognito:username'] ?? '',
            'email' => $payload['email'] ?? '',
            'firstname' => $payload['given_name'] ?? '',
            'lastname' => $payload['family_name'] ?? '',
            'sub' => $payload['sub'] ?? '',
            'email_verified' => $payload['email_verified'] ?? false,
        ];
    }

    /**
     * Base64 URLデコード（JWT用）
     *
     * @param string $input Base64 URL エンコードされた文字列
     * @return string|false デコードされた文字列、またはfalse
     */
    private static function base64_url_decode($input) {
        $remainder = strlen($input) % 4;
        if ($remainder) {
            $padlen = 4 - $remainder;
            $input .= str_repeat('=', $padlen);
        }
        return base64_decode(strtr($input, '-_', '+/'));
    }

    /**
     * Cognitoトークンの検証
     *
     * @param string $jwt_token JWTトークン
     * @param string $user_pool_id Cognito User Pool ID
     * @param string $region AWSリージョン
     * @return bool 検証結果
     */
    public static function validate_token($jwt_token, $user_pool_id, $region = 'ap-northeast-1') {
        global $CFG;

        // JWKSエンドポイントからPublic Keyを取得
        $jwks_url = "https://cognito-idp.{$region}.amazonaws.com/{$user_pool_id}/.well-known/jwks.json";

        // トークンのヘッダーを取得
        $parts = explode('.', $jwt_token);
        if (count($parts) !== 3) {
            return false;
        }

        $header = json_decode(self::base64_url_decode($parts[0]), true);
        if (!isset($header['kid'])) {
            return false;
        }

        // JWKSを取得してキャッシュ
        $cache_key = 'cognito_jwks_' . md5($user_pool_id);
        $cache = \cache::make('core', 'config');
        $jwks = $cache->get($cache_key);

        if (!$jwks) {
            $jwks_response = file_get_contents($jwks_url);
            if (!$jwks_response) {
                debugging('Failed to fetch JWKS from Cognito', DEBUG_DEVELOPER);
                return false;
            }
            $jwks = json_decode($jwks_response, true);
            $cache->set($cache_key, $jwks);
        }

        // 簡易検証（本番環境では適切なJWTライブラリを使用すべき）
        $payload = json_decode(self::base64_url_decode($parts[1]), true);

        // トークンの期限チェック
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            debugging('Token expired', DEBUG_DEVELOPER);
            return false;
        }

        // Issuerチェック
        $expected_issuer = "https://cognito-idp.{$region}.amazonaws.com/{$user_pool_id}";
        if (!isset($payload['iss']) || $payload['iss'] !== $expected_issuer) {
            debugging('Invalid issuer', DEBUG_DEVELOPER);
            return false;
        }

        return true;
    }

    /**
     * Cognitoユーザー属性をMoodleユーザーレコードにマッピング
     *
     * @param array $cognito_user Cognitoユーザー情報
     * @return stdClass Moodleユーザーレコード
     */
    public static function map_to_moodle_user($cognito_user) {
        $user = new \stdClass();

        $user->username = $cognito_user['username'] ?? '';
        $user->email = $cognito_user['email'] ?? '';
        $user->firstname = $cognito_user['firstname'] ?? '';
        $user->lastname = $cognito_user['lastname'] ?? '';
        $user->confirmed = $cognito_user['email_verified'] ?? false ? 1 : 0;
        $user->auth = 'oauth2';

        return $user;
    }
}
