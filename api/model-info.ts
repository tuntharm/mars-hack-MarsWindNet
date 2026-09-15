import { handleGateway, methodNotAllowed } from './_lib/gateway.js'

export const GET = (request: Request) => handleGateway(request, '/model-info')
export const POST = () => methodNotAllowed('GET')
export const PUT = POST
export const PATCH = POST
export const DELETE = POST
export const OPTIONS = POST
export const HEAD = POST
