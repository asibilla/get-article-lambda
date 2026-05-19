import { APIGatewayEvent } from 'aws-lambda'
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, getTableName } from './util/dynamodb';

export const lambdaHandler = async (event: APIGatewayEvent) => {
    try {
        const id = event.queryStringParameters?.id ?? '';
        const type = event.queryStringParameters?.type ?? '';
        const queryByType = !id;
        const tableName = getTableName();
        if (!tableName) {
            throw new Error('ARTICLE_TABLE_NAME is not set');
        }

        const params = {
            TableName: tableName,
            ...(queryByType ? { IndexName: 'article-type' } : {}),
            KeyConditionExpression: `#ind = :v`,
            ExpressionAttributeNames: {
                "#ind": queryByType ? 'article-type' : 'article-id'
            },
            ExpressionAttributeValues: {
                ':v': queryByType ? type : id
            }
        };
    
        const result = await docClient.send(new QueryCommand(params));
        console.log(result);

    
    } catch (error) {
        console.log('an error occurred', error);
    }
    const response = {
        statusCode: 200,
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            message: "Hello World",
        }),
    };

    return response;
}

