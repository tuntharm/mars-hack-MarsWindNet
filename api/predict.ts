import { handleGateway, methodNotAllowed } from './_lib/gateway.js'

export const POST = (request: Request) => handleGateway(request, '/predict')
export const GET = () => methodNotAllowed('POST')
export const PUT = GET
export const PATCH = GET
export const DELETE = GET
export const OPTIONS = GET
export const HEAD = GET
