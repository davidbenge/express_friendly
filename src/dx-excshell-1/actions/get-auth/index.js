/**
 * This takes all the needed params and passes back a jwt token for use
 * 
 * Do not remove the \r\n from the private key if its not the base64 version
 */


const fetch = require('node-fetch')
const { Core } = require('@adobe/aio-sdk')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('../utils')
const jwt = require('jsonwebtoken');
const FormData = require('form-data');

const MISSING_PARAMS = 'missing_params';
const SIGN_FAILED = 'sign_failed';
const REQUEST_FAILED = 'request_failed';
const UNEXPECTED_RESPONSE_BODY = 'invalid_response_body';

// main function that will be executed by Adobe I/O Runtime
/* 
* @param {object} params - raw request parameters
* @param {string} params.private_key - Do not remove the \r\n from the private key if its not the base64 version
*/
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })

  try {
    // 'info' is the default level if not set
    logger.info('Calling the auth action')

    // log parameters, only if params.LOG_LEVEL === 'debug'
    logger.debug(stringParameters(params))

    // check for missing request input parameters and headers
    const requiredParams = ['client_id','technical_account_id','org_id','client_secret','private_key','meta_scopes','IMS']
    const requiredHeaders = []
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }
    const passphrase = params.passphrase || ''
    logger.debug("Finished checking params")

    if (params.meta_scopes.constructor !== Array) {
      params.meta_scopes = params.meta_scopes.split(',')
    }   

    if(params.private_key_base64){
       try {
         let decodedKeyBuffer = Buffer.from(params.private_key, 'base64')
         decodedKey = decodedKeyBuffer.toString('utf8')
         params.private_key = decodedKey
       } catch (error) {
         logger.warn(`problem converting private_key from base64 ${error.message}`)
       }
    }

    const jwtPayload = {
      exp: Math.round(300 + Date.now() / 1000),
      iss: params.org_id,
      sub: params.technical_account_id,
      aud: `${params.IMS}/c/${params.client_id}`
    };
  
    for (let i = 0; i < params.meta_scopes.length; i++) {
      if (params.meta_scopes[i].indexOf('https') > -1) {
        jwtPayload[params.meta_scopes[i]] = true
      } else {
        jwtPayload[`${params.IMS}/s/${params.meta_scopes[i]}`] = true
      }
    }
    logger.debug("Finished setting up signing payload")

    let token
    try {
      token = jwt.sign(
        jwtPayload,
        { key: params.private_key, passphrase },
        { algorithm: 'RS256' }
      );
    } catch (tokenError) {
      logger.error(tokenError)
      return errorResponse(500,SIGN_FAILED, logger)
    }
    logger.debug("Finished signing")

    const form = new FormData()
    form.append('client_id', params.client_id)
    form.append('client_secret', params.client_secret)
    form.append('jwt_token', token)

    const postOptions = {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    };
    logger.debug("Form built")

    // fetch content from external api endpoint
    const res = await fetch(`${params.IMS}/ims/exchange/jwt/`, postOptions)
    if (!res.ok) {
     logger.warn(`request to ${params.IMS}/ims/exchange/jwt/ failed with status code ${res.status} status text ${res.statusText}`)
      throw new Error(`request to ${params.IMS}/ims/exchange/jwt/ failed with status code ${res.status} status text ${res.statusText}`)
    }
    let content = await res.json()
    const response = {
      statusCode: 200,
      body: content
    }

    if(params.hasOwnProperty('tenant_name') && params.hasOwnProperty('sandbox_name') && params['tenant_name'].length > 0 && params['sandbox_name'].length > 0) {
      let psql = "psql 'sslmode=require host=" + params.tenant_name + ".platform-query.adobe.io port=80 dbname=" + params.sandbox_name + ":all user=" + params.org_id + " password=" + content.access_token + "'"
      response.body.psql = psql
    }

    // log the response status code
    logger.info(`${response.statusCode}: auth successful request`)
    return response
  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, 'server error', logger)
  }
}

exports.main = main