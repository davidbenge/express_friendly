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
const { getJwtToken } = require('../adobeAuthUtils');

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
    const requiredParams = ['client_id','technical_account_id','org_id','client_secret','private_key','meta_scopes']
    const requiredHeaders = []
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }
    logger.debug("Finished checking params")

    /***
     * convert the meta_scopes to an array if its a string
     */
    if (params.meta_scopes.constructor !== Array) {
      params.meta_scopes = params.meta_scopes.split(',')
    }   

    /**
     * decode the private key if its base64
     */
    if(params.private_key_base64){
      try {
        let decodedKeyBuffer = Buffer.from(params.private_key, 'base64')
        decodedKey = decodedKeyBuffer.toString('utf8')
        params.private_key = decodedKey
      } catch (error) {
        logger.warn(`problem converting private_key from base64 ${error.message}`)
      }
   }

    const invokeParams = {
      "client_id":`${params.client_id}`,
      "technical_account_id":`${params.technical_account_id}`,
      "org_id":`${params.org_id}`,
      "client_secret":`${params.client_secret}`,
      "private_key":`${params.private_key}`,
      "meta_scopes":params.meta_scopes
    }

    /**
     * if we need to change the ims endpoint
     */
    if(params.hasOwnProperty('ims') && params.ims.length > 0){
      invokeParams.ims = params.ims
    }

    let invokeResult = await getJwtToken(invokeParams,params,logger)

    const response = {
      statusCode: 200,
      body: invokeResult
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