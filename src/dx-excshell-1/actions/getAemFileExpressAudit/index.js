/*
* <license header>
*/

/**
 * This is a sample action showcasing how to access an external API
 *
 * Note:
 * You might want to disable authentication and authorization checks against Adobe Identity Management System for a generic action. In that case:
 *   - Remove the require-adobe-auth annotation for this action in the manifest.yml of your application
 *   - Remove the Authorization header from the array passed in checkMissingRequestInputs
 *   - The two steps above imply that every client knowing the URL to this deployed action will be able to invoke it without any authentication and authorization checks against Adobe Identity Management System
 *   - Make sure to validate these changes against your security requirements before deploying the action
 */


const fetch = require('node-fetch')
const { errorResponse, checkMissingRequestInputs, contentInit, stringParameters } = require('../utils')
const { Core, State, Files, Logger } = require('@adobe/aio-sdk')
const { getAemAssetData, writeCommentToAsset, writeJsonExpressCompatibiltyReportToComment } = require('../aemCscUtils')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('main', { level: params.LOG_LEVEL || 'info' })
  
  logger.debug(stringParameters(params))

  const actionName = 'expressAudit'
  let debuggerOutput = null

  moduleOutput = function(data){
    content.modules[actionName] = data
  }
  
  try {
    // 'info' is the default level if not set
    logger.info('Calling the main check manifest function')

    // check for missing request input parameters and headers
    const requiredParams = ['manifest','aemHost','aemAssetPath']
    const requiredHeaders = []
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      // return and log client errors
      return errorResponse(400, errorMessage, logger)
    }
    const content = contentInit(params) 

    // log parameters, only if params.LOG_LEVEL === 'debug'
    if(params.LOG_LEVEL === 'debug'){
      if(typeof content.debug == 'undefined') {
        content.debug = {}
        content.debug[actionName] = []
      }
    }

    debuggerOutput = function(message){
      if(params.LOG_LEVEL === 'debug'){
        if(typeof message === 'string'){
          content.debug[actionName].push({"debugMessage":message})
        }else{
          content.debug[actionName].push(message)
        }
      }
    }

    content.artboardCount = 0
    debuggerOutput('manifest clean')
    let manifestClean
    if(typeof params.manifest !== "object") {
      debuggerOutput('manifest type string')
      return errorResponse(400, 'manifest type is not an json object', logger)
    }else{
      debuggerOutput('manifest clean object')
      manifestClean = params.manifest
    }
    
    //output params to output structure
    //debuggerOutput(params)

    /**** 
     * Checks logic 
     * 
     * 1. get size < 500mb
     * 2. Art board count
     * 3. Smart object with non rasterized layers
     * 4. Text layers with style
     * 5. width and height < 8k
     * 
     * */

    // too many artboards?  #2
    const numberOfArtBoardsInManifest = (manifest) => {
      if (typeof manifest !== "object") {
        console.error("manifest needs to be an object")
        throw new Error("manifest needs to be an object")
      }
    
      let artBoardCount = 0;
      manifest.outputs.map((output) => {
        output.layers.map((layer) => {
          if (layer.type && layer.type == "layerSection") {
            artBoardCount = artBoardCount + 1
          }
        });
      });
    
      return artBoardCount
    };
    
    content.artboardCount = numberOfArtBoardsInManifest(manifestClean)
    content.artboardCountOk = content.artboardCount > 2 ? false : true
    content.status = content.artboardCountOk ? 'ok' : 'error'
    content.bitDepth = manifestClean.outputs[0].document.bitDepth
    // 5. width and height < 8k
    content.width = manifestClean.outputs[0].document.width
    content.widthOk = content.width > 8000 ? false : true
    content.status = content.widthOk ? 'ok' : 'error'
    // 5. width and height < 8k
    content.height = manifestClean.outputs[0].document.height
    content.heightOk = content.height > 8000 ? false : true
    content.status = content.heightOk ? 'ok' : 'error'
    content.iccProfileName = manifestClean.outputs[0].document.iccProfileName
    content.imageMode = manifestClean.outputs[0].document.imageMode

    //if the call was done after events collected all the needed aem data we can skip hitting aem again
    // 1. get size < 500mb
    if(typeof params.jobSecodaryData !== 'undefined'){
      content.size = params.jobSecodaryData.aemAssetSize
      content.sizeOk = content.size > 520093696 ? false : true
      content.status = content.sizeOk ? 'ok' : 'error'
    }
    else{
      // Change this to the path of the image you want to check
      const aemImageData = await getAemAssetData(params.aemHost,params.aemAssetPath,params,logger)
      debuggerOutput('aemImageData')
      debuggerOutput(aemImageData)

      if(typeof aemImageData !== 'undefined' && typeof aemImageData.body !== 'undefined'){
        debuggerOutput("aem file got image data")
        debuggerOutput(aemImageData)
        content.size = aemImageData.body.aemImageData['jcr:content']['metadata']['dam:size']
        content.sizeOk = content.size > 520093696 ? false : true
        content.status = content.sizeOk ? 'ok' : 'error'
      }else{
        debuggerOutput(aemImageData)
        debuggerOutput("failed to get aem file data")
        logger.error("Failed to get aem file data")
      }
    } 

    // Write the report to the asset
    await writeJsonExpressCompatibiltyReportToComment(params.aemHost,params.aemAssetPath,content,params,logger)

    //TODO: write a metadata tag to the asset with the status of the audit
    
    const response = {
      statusCode: 200,
      body: content
    }

    return response
  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, 'server error', logger)
  }
}

exports.main = main
