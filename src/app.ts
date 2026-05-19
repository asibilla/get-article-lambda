import { APIGatewayEvent } from 'aws-lambda'
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, getTableName } from './util/dynamodb';

export const lambdaHandler = async (event: APIGatewayEvent) => {
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
        if (result && result.Items) {
            return {
                body: JSON.stringify({
                    response: result.Items
                }),
                headers: {
                    "Content-Type": "application/json"
                },
                statusCode: 200,
            };
        }

        return {
            body: JSON.stringify({
                response: new Error(`Could not find results for ${articleId} ${articleType}`)
            }),
            headers: {
                "Content-Type": "application/json"
            },
            statusCode: 404,
        }
    } catch (error) {
        return {
            body: JSON.stringify({
                response: error,
            }),
            headers: {
                "Content-Type": "application/json",
            },
            statusCode: 500
        };
    }
}

