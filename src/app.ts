import { APIGatewayEvent } from 'aws-lambda'

export const lambdaHandler = (event: APIGatewayEvent) => {
    console.log('hi from lambda!', event)
}

