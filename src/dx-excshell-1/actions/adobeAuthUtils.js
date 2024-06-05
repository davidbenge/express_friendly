/* 
* <license header>
*/

/* This file exposes some common auth utils */
const fetch = require('node-fetch')
const { Core } = require('@adobe/aio-sdk')
const { errorResponse, getBearerToken, stringParameters, checkMissingRequestInputs } = require('./utils')
const jwt = require('jsonwebtoken')
const FormData = require('form-data')
const auth = require("@adobe/jwt-auth")

/***
 * Get aem jwt account token
 * 
 * @param {object} authOptions - raw request parameters
 * @param {string} authOptions.client_id - client id
 * @param {string} authOptions.technical_account_id - technical account id
 * @param {string} authOptions.org_id - org id
 * @param {string} authOptions.client_secret - client secret
 * @param {string} authOptions.private_key - PrivateKey is a string (utf-8 encoded), buffer, object, or KeyObject containing either the secret for HMAC algorithms or the PEM encoded private key for RSA and ECDSA
 * @param {boolean} authOptions.private_key_base64 - private key base64 encoded
 * @param {Array<string>} authOptions.meta_scopes - meta scopes
 * @param {string} authOptions.ims_endpoint - IMS https://ims-na1.adobelogin.com
 * @param {object} params - raw request parameters
 * @param {object} logger - logger object
 * 
 * return {object} tokenResponse - token response
 * return {string} tokenResponse.access_token - access token
 * return {string} tokenResponse.token_type - token type
 * return {string} tokenResponse.expires_in - expires in
 */
async function getJwtToken(authOptions,params,logger){

  const config = {
    clientId: authOptions.client_id,
    clientSecret: authOptions.client_secret,
    technicalAccountId: authOptions.technical_account_id,
    orgId: authOptions.org_id,
    metaScopes: authOptions.meta_scopes,
    privateKey: authOptions.private_key.replace(/\\r\\n/g, '\r\n'),
  };

  //logger.debug(`authOptions: ${JSON.stringify(authOptions, null, 2)}`)  
  //logger.debug(`call config: ${JSON.stringify(config, null, 2)}`)  

  let tokenResponse = await auth(config);

  logger.debug(`tokenResponse: ${JSON.stringify(tokenResponse, null, 2)}`)
  
  return tokenResponse
}

module.exports = {
  getJwtToken
}