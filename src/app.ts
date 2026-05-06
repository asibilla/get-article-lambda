import { APIGatewayEvent } from 'aws-lambda'

export const lambdaHandler = (event: APIGatewayEvent) => {
    console.log('hi from lambda!', event);
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

