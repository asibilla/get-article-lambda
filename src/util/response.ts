import type { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getCorsHeaders } from './cors'; 

export const jsonResponse = (
    event: APIGatewayEvent,
    statusCode: number,
    body: unknown,
): APIGatewayProxyResult => ({
    statusCode,
    headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(event),
    },
    body: JSON.stringify(body),
});