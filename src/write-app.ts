import { APIGatewayEvent } from 'aws-lambda';
import {
    DeleteCommand,
    PutCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { handleWriteOptions } from './util/cors';
import { docClient, getTableName } from './util/dynamodb';
import { jsonResponse } from './util/response';

type JsonRecord = Record<string, unknown>;

const parseBody = (event: APIGatewayEvent): JsonRecord => {
    if (!event.body) {
        throw new Error('Request body is required');
    }
    const raw = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString()
        : event.body;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Request body must be a JSON object');
    }
    return parsed as JsonRecord;
};

const requireKey = (body: JsonRecord): JsonRecord => {
    const key = body.key;
    if (!key || typeof key !== 'object' || Array.isArray(key)) {
        throw new Error('Request body must include a "key" object');
    }
    if (!Object.keys(key as JsonRecord).length) {
        throw new Error('Request body "key" must not be empty');
    }
    return key as JsonRecord;
};

const buildUpdateExpression = (updates: JsonRecord) => {
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    const setParts: string[] = [];

    for (const [field, value] of Object.entries(updates)) {
        const nameKey = `#${field.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const valueKey = `:${field.replace(/[^a-zA-Z0-9]/g, '_')}`;
        names[nameKey] = field;
        values[valueKey] = value;
        setParts.push(`${nameKey} = ${valueKey}`);
    }

    if (!setParts.length) {
        throw new Error('Request body "updates" must include at least one attribute');
    }

    return {
        UpdateExpression: `SET ${setParts.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
    };
};

const putItem = async (tableName: string, body: JsonRecord) => {
    const item = body.item;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error('Request body must include an "item" object');
    }
    await docClient.send(new PutCommand({ TableName: tableName, Item: item as JsonRecord }));
    return { item };
};

const updateItem = async (tableName: string, body: JsonRecord) => {
    const key = requireKey(body);
    const updates = body.updates;
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        throw new Error('Request body must include an "updates" object');
    }
    const expression = buildUpdateExpression(updates as JsonRecord);
    const result = await docClient.send(new UpdateCommand({
        TableName: tableName,
        Key: key,
        ...expression,
        ReturnValues: 'ALL_NEW',
    }));
    return { item: result.Attributes };
};

const deleteItem = async (tableName: string, body: JsonRecord) => {
    const key = requireKey(body);
    await docClient.send(new DeleteCommand({ TableName: tableName, Key: key }));
    return { key };
};

export const lambdaHandler = async (event: APIGatewayEvent) => {
    if (event.httpMethod === 'OPTIONS') {
        return handleWriteOptions(event);
    }

    try {
        const tableName = getTableName();
        if (!tableName) {
            throw new Error('ARTICLE_TABLE_NAME is not set');
        }

        const body = parseBody(event);
        let response: unknown;

        switch (event.httpMethod) {
            case 'PUT':
                response = await putItem(tableName, body);
                break;
            case 'PATCH':
                response = await updateItem(tableName, body);
                break;
            case 'DELETE':
                response = await deleteItem(tableName, body);
                break;
            default:
                return jsonResponse(event, 405, { response: { error: 'Method not allowed' } });
        }

        return jsonResponse(event, 200, { response });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const statusCode = message.startsWith('Request body') ? 400 : 500;
        return jsonResponse(event, statusCode, { response: { error: message } });
    }
};
