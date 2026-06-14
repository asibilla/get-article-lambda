import type { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';

const getAllowedOrigins = (): string[] => {
    const raw = process.env.ALLOWED_ORIGINS ?? '';
    return raw.split(',').map((o) => o.trim()).filter(Boolean);
};

const getRequestOrigin = (event: APIGatewayEvent): string | undefined => {
    const headers = event.headers ?? {};
    return headers.origin ?? headers.Origin;
};

export const getCorsHeaders = (event: APIGatewayEvent): Record<string, string> => {
    const origin = getRequestOrigin(event);

    const allowed = getAllowedOrigins();
    if (!origin || !allowed.includes(origin)) {
        return {};
    }
    return {
        'Access-Control-Allow-Origin': origin,
        Vary: 'Origin',
    };
};

const IAM_AUTH_HEADERS =
    'Content-Type,Authorization,X-Amz-Date,X-Amz-Security-Token,X-Amz-Content-Sha256';

export const handleOptions = (
    event: APIGatewayEvent,
    methods = 'GET,OPTIONS',
    allowHeaders = 'Content-Type',
): APIGatewayProxyResult => {
    const cors = getCorsHeaders(event);
    if (!cors['Access-Control-Allow-Origin']) {
        return { statusCode: 403, body: JSON.stringify({ error: new Error('Invalid Origin') }) };
    }
    return {
        statusCode: 204,
        headers: {
            ...cors,
            'Access-Control-Allow-Methods': methods,
            'Access-Control-Allow-Headers': allowHeaders,
            'Access-Control-Max-Age': '86400',
        },
        body: '',
    };
};

export const handleWriteOptions = (event: APIGatewayEvent): APIGatewayProxyResult =>
    handleOptions(event, 'PUT,PATCH,DELETE,OPTIONS', IAM_AUTH_HEADERS);
