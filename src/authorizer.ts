import type { APIGatewayRequestAuthorizerEvent, APIGatewayAuthorizerResult } from 'aws-lambda'

const CLOUDFRONT_SECRET = process.env.CLOUDFRONT_SECRET ?? '';

const buildPolicy = (
    effect: 'Allow' | 'Deny',
    resource: string,
): APIGatewayAuthorizerResult => {
    return {
        principalId: 'cloudfront',
        policyDocument: {
            Version: '2012-10-17',
            Statement: [{
                Action: 'execute-api:Invoke',
                Effect: effect,
                Resource: resource,
            }]
        }
    }
}

export const lambdaHandler = async (
    event: APIGatewayRequestAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
    const secretHeader = event.headers?.['X-Origin-Secret'];
    const isAuthorized = CLOUDFRONT_SECRET.length > 0 && secretHeader === CLOUDFRONT_SECRET;
    return buildPolicy(isAuthorized ? 'Allow' : 'Deny', event.methodArn);
}