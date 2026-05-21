import { APIGatewayEvent } from 'aws-lambda'
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { handleOptions } from './util/cors';
import { docClient, getTableName } from './util/dynamodb';
import { jsonResponse } from './util/response';

export const lambdaHandler = async (event: APIGatewayEvent) => {
    if (event.httpMethod === 'OPTIONS') {
        return handleOptions(event);
    }

    try {
        const articleId = event.queryStringParameters?.id ?? '';
        const articleType = event.queryStringParameters?.type ?? '';
        const queryByType = !articleId;
        const tableName = getTableName();
        if (!tableName) {
            throw new Error('ARTICLE_TABLE_NAME is not set');
        }

        const params = {
            TableName: tableName,
            ...(queryByType ? { IndexName: 'article-type' } : {}),
            KeyConditionExpression: `#k = :v`,
            ExpressionAttributeNames: {
                "#k": queryByType ? 'article-type' : 'article-id'
            },
            ExpressionAttributeValues: {
                ':v': queryByType ? articleType : articleId
            }
        };
    
        const result = await docClient.send(new QueryCommand(params));
        if (result?.Items?.length) {
            return jsonResponse(event, 200, { response: result.Items });
        }

        return jsonResponse(
            event,
            404,
            { response: { error: new Error(`Could not find results for id=${articleId} type=${articleType}`) } },
        );
    } catch (error) {
        return jsonResponse(event, 500, { response: { error: error } });
    }
}
