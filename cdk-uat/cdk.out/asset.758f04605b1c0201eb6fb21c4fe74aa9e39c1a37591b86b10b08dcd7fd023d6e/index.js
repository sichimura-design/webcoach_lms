'use strict';

const crypto = require('crypto');

// CDK deploy 時に --context contentTokenSecret=<secret> で埋め込まれる
const TOKEN_SECRET = '17dc2004507a19c9967424e46379e12617c620cd25fdbfcd0bbbe9b68f895e3f';

const COOKIE_NAME = 'cf_access';

const PROTECTED_PREFIXES = ['html-content/', 'course-images/'];

function parseCookies(cookieHeader) {
    if (!cookieHeader) return {};
    return cookieHeader.split(';').reduce((acc, pair) => {
        const idx = pair.indexOf('=');
        if (idx < 0) return acc;
        acc[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
        return acc;
    }, {});
}

/**
 * トークン検証
 * BFF が発行するトークン形式: base64(userId:expiry:hmac_hex)
 */
function verifyToken(token) {
    if (!token) return false;
    try {
        const decoded = Buffer.from(token, 'base64url').toString('utf8');
        const lastColon = decoded.lastIndexOf(':');
        if (lastColon < 0) return false;

        const data = decoded.slice(0, lastColon);
        const signature = decoded.slice(lastColon + 1);

        const colonIdx = data.indexOf(':');
        if (colonIdx < 0) return false;
        const expiry = parseInt(data.slice(colonIdx + 1), 10);
        if (isNaN(expiry) || Date.now() > expiry) return false;

        const expected = crypto.createHmac('sha256', TOKEN_SECRET)
            .update(data)
            .digest('hex');

        const sigBuf = Buffer.from(signature, 'hex');
        const expBuf = Buffer.from(expected, 'hex');
        if (sigBuf.length !== expBuf.length) return false;

        return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
        return false;
    }
}

function isProtectedPath(uri) {
    const path = uri.startsWith('/') ? uri.slice(1) : uri;
    return PROTECTED_PREFIXES.some(prefix => path.startsWith(prefix));
}

exports.handler = async (event) => {
    const request = event.Records[0].cf.request;
    const uri = request.uri;

    if (!isProtectedPath(uri)) {
        return request;
    }

    const headers = request.headers;

    const cookieHeader = headers.cookie?.[0]?.value || '';
    const cookies = parseCookies(cookieHeader);
    const cookieToken = cookies[COOKIE_NAME];

    const qs = request.querystring || '';
    const qsToken = qs.split('&').reduce((val, pair) => {
        const [k, v] = pair.split('=');
        return k === 'cf_token' ? decodeURIComponent(v || '') : val;
    }, '');

    const token = cookieToken || qsToken;

    if (verifyToken(token)) {
        return request;
    }

    return {
        status: '401',
        statusDescription: 'Unauthorized',
        headers: {
            'content-type': [{ key: 'Content-Type', value: 'application/json' }],
            'cache-control': [{ key: 'Cache-Control', value: 'no-store' }],
        },
        body: JSON.stringify({ error: 'Unauthorized', message: 'ログインが必要です' }),
    };
};
