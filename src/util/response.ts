import type { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCacheControlHeaders, getCorsHeaders } from './cors';

export const jsonResponse = (
    event: APIGatewayEvent,
    statusCode: number,
    body: unknown,
    options?: { cacheControl?: boolean },
): APIGatewayProxyResult => ({
    statusCode,
    headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(event),
        ...(options?.cacheControl ? getCacheControlHeaders(event) : {}),
    },
    body: JSON.stringify(body),
});