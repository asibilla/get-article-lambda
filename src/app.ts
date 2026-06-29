import { APIGatewayEvent } from 'aws-lambda'
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { handleOptions } from './util/cors';
import { docClient, getTableName } from './util/dynamodb';
import { jsonResponse } from './util/response';

const PAGE_SIZE = 20;

const encodeCursor = (key: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(key)).toString('base64url');

const decodeCursor = (cursor: string): Record<string, unknown> => {
    try {
        const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Invalid cursor');
        }
        return parsed as Record<string, unknown>;
    } catch {
        throw new Error('Invalid cursor');
    }
};

export const lambdaHandler = async (event: APIGatewayEvent) => {
    if (event.httpMethod === 'OPTIONS') {
        return handleOptions(event);
    }

    try {
        const articleId = event.queryStringParameters?.id ?? '';
        const articleType = event.queryStringParameters?.type ?? '';
        const cursor = event.queryStringParameters?.cursor;
        const queryByType = !articleId;
        const tableName = getTableName();
        if (!tableName) {
            throw new Error('ARTICLE_TABLE_NAME is not set');
        }

        const params: ConstructorParameters<typeof QueryCommand>[0] = {
            TableName: tableName,
            ...(queryByType ? {
                IndexName: 'article-type',
                Limit: PAGE_SIZE,
                ScanIndexForward: false,
                ProjectionExpression: '#articleId, #k, #date, displayTitle',
            } : {}),
            KeyConditionExpression: `#k = :v`,
            ExpressionAttributeNames: {
                '#k': queryByType ? 'article-type' : 'article-id',
                ...(queryByType ? {
                    '#articleId': 'article-id',
                    '#date': 'date',
                } : {}),
            },
            ExpressionAttributeValues: {
                ':v': queryByType ? articleType : articleId
            }
        };

        if (queryByType && cursor) {
            params.ExclusiveStartKey = decodeCursor(cursor);
        }
    
        const result = await docClient.send(new QueryCommand(params));
        const items = result.Items ?? [];

        if (!queryByType && !items.length) {
            return jsonResponse(
                event,
                404,
                { response: { error: new Error(`Could not find results for id=${articleId} type=${articleType}`) } },
                { cacheControl: true },
            );
        }

        const nextCursor = queryByType && result.LastEvaluatedKey
            ? encodeCursor(result.LastEvaluatedKey)
            : undefined;

        return jsonResponse(
            event,
            200,
            {
                response: {
                    items,
                    ...(nextCursor ? { nextCursor } : {}),
                },
            },
            { cacheControl: true },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const statusCode = message === 'Invalid cursor' ? 400 : 500;
        return jsonResponse(event, statusCode, { response: { error: message } });
    }
}
