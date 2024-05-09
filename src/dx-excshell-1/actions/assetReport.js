/**** 
 * assetReport
 * 
 * Checks logic - via Ryan Mulvaney 5-24
 * 
 * 1. Filesize is greater than 500 MB +
 * 2. image size is greater than 8k by 8k +
 * 3. Color space equals sRGB (can't be CMKY)
 * 4. File has more than one artboard +
 * 5. File has Less than 10 photoshop layers (this one I'm kind of making up.  There's no real guidance here so maybe skip but anything with more than 10 layers just seems like a lot to handle in Express for a non creative)
 * 6. A layer contains a Smart Object
 * 7. A Text layer has a layer style applied
 * 8. A non Adobe Font is used (There is not an existing list of all Adobe Fonts so I'm not sure how this would flag in the manifest but the photoshop file does flag if a font is missing when opened.  I should show you an example with one of the Pfizer files if needed) (edited) 
 * 
 * */

const { Core, Files } = require('@adobe/aio-sdk')

const AssetReportEngine = class {
    constructor(storagePath,logger) {
        this.storagePath = storagePath || 'asset-report/'
        this.logger = logger || Core.Logger('AssetReportEngine', { level: 'info' })
        this.fileLibInit = false
    }

    async getFileLib() {
        if (!this.fileLibInit) {
            this.fileLib = await Files.init()
            this.fileLibInit = true
        }
        return this.fileLib
    }

    async getAssetReportData(filename) {
        let fileLib = await this.getFileLib()
        const stateListResult = await fileLib.list(`${this.storagePath}`)

        //now lets setup the results counter object
        let assetReport = {
            total_count: 0,
            size_was_issue: 0,
            width_was_issue: 0,
            height_was_issue: 0,  
            artboardCount_was_issue: 0,
            report_debug: []
        }

        for(let i = 0; i < stateListResult.length; i++){
            let reportBuffer = await fileLib.read(stateListResult[i].name)

            let currentReport = JSON.parse(reportBuffer.toString())
            //assetReport.report_debug.push(currentReport)

            assetReport.total_count++
            if(currentReport.sizeOk === false){
                assetReport.size_was_issue++
            }
            if(currentReport.widthOk === false){
                assetReport.width_was_issue++
            }
            if(currentReport.heightOk === false){
                assetReport.height_was_issue++
            }
            if(currentReport.artboardCountOk === false){
                assetReport.artboardCount_was_issue++
            }
        }

        return assetReport
    }

    /***
     * clean the asset report data files
     * 
     * @returns {boolean} true if the files were deleted
     */
    async cleanAssetReportData() {
        let fileLib = await this.getFileLib()
        await fileLib.delete(this.storagePath);

        return true
    }

    /*****
     * get the asset report object for use with the engine
     * 
     * @param {string} filename the filename of the asset report to create
     */
    getNewAssetReport(filename) {
        if(typeof filename === 'undefined'){
            filename = `${Date.now()}-${Math.floor(Math.random() * 1000)}-asset-report.json` //randomize the filename
        }
        this.currentAssetReport = new AssetReport(filename)
        return this.currentAssetReport
    }

    /*****
     * save the asset report to the storage
     * 
     * @param {AssetReport} report asset report object
     * 
     * @returns {string} stateResult The results object from the aio FILE opperation
     */
    async saveAssetReport(report) {
        let fileLib = await this.getFileLib()
        this.logger.debug(`saving asset report ${report.filename} to ${this.storagePath}`)
        const stateResult = await fileLib.write(`${this.storagePath}${report.filename}`, JSON.stringify(report.getReportAsJson()));

        return stateResult
    }

    /*****
     * If you create a new asset report object, you can save it with this function
     * 
     * @returns {object} stateResult The results object from the aio FILE opperation
     */
    async saveCurrentAssetReport() {
        const stateResult =  await this.saveAssetReport(this.currentAssetReport)

        return stateResult
    }
}
/*****
 * AssetReport
 * 
 * This class is used to create an asset report object that can be used to store and report on the asset data
 * 
 */
const AssetReport = class{
    constructor(pFilename){
      this._filename = pFilename
      this._artboardCount = 0
      this._bitDepth = 'na'
      this._size = 0
      this._width = 0
      this._height = 0
      this._iccProfileName = 0
      this._imageMode = 'na'
      this._aemFileName =''
      this._aemFilePath = ''
      this._aemFileUuid = ''
    }

    /****** getters/setters  ******/
    get status(){
        if(this.artboardCountOk && this.widthOk && this.heightOk && this.sizeOk){
            return 'ok'
        }else{
            return 'error'
        }
    }

    get artboardCountOk(){
        return this.artboardCount > 1 ? false : true
    }

    get widthOk(){
        return this.width > 8000 ? false : true
    }

    get heightOk(){
        return this.height > 8000 ? false : true
    }

    get sizeOk(){
        return this.size > 520093696 ? false : true
    }

    set artboardCount(value){
        this._artboardCount = value
    }
    get artboardCount(){
        return this._artboardCount
    }

    set bitDepth(value){
        this._bitDepth = value
    }   
    get bitDepth(){     
        return this._bitDepth
    }

    set size(value){    
        this._size = value       
    }
    get size(){ 
        return this._size
    }

    set width(value){     
        this._width = value
    }   
    get width(){    
        return this._width
    }

    set height(value){   
        this._height = value
    }
    get height(){   
        return this._height
    }   

    set iccProfileName(value){
        this._iccProfileName = value
    }   
    get iccProfileName(){
        return this._iccProfileName
    }

    set imageMode(value){   
        this._imageMode = value
    }
    get imageMode(){
        return this._imageMode
    }

    get filename(){
        return this._filename
    }   

    set filename(value){
        this._filename = value
    }

    get aemFilePath(){
        return this._aemFilePath
    }

    set aemFilePath(value){
        this._aemFilePath = value
    }   

    get aemFileName(){  
        return this._aemFileName
    }   

    set aemFileName(value){ 
        this._aemFileName = value
    }   

    set aemFileUuid(value){    
        this._aemFileUuid = value
    }

    get aemFileUuid(){ 
        return this._aemFileUuid
    }


    /******** QA Rules ********/
    /****
     * set the artboard count
     * 
     * @param {object} manifest json manifest object from photoshop api
     */
    setArtboardCount(manifest){
        this._artboardCountartboardCount = this.numberOfArtBoardsInManifest(manifest)
    }

    /****
     * get a count of the artboards in the manifest
     * 
     * @param {object} manifest json manifest object from photoshop api
     */
    numberOfArtBoardsInManifest(manifest){
        if (typeof manifest !== "object") {
          throw new Error("manifest needs to be an object")
        }
      
        let artBoardCount = 0;
        manifest.outputs.map((output) => {
          output.layers.map((layer) => {
            if (layer.type && layer.type == "layerSection") {
              artBoardCount = artBoardCount + 1
            }
          })
        })
      
        return artBoardCount
    }

    /******
     * set values based on the secondary job data that Might have been passed from the job
     *
     * @param {object} jobSecodaryData json object with secondary job data
     */
    setReportValuesBasedOnSecondaryJobData(jobSecodaryData){
      this.size = jobSecodaryData.aemAssetSize
      this.aemFileName = jobSecodaryData.aemAssetName
      this.aemFilePath = jobSecodaryData.aemAssetPath
      this.aemFileUuid = jobSecodaryData.aemAssetUuid
    }

    /*****
     * set the values based on the manifest 
     * namely bitDepth, width, height, iccProfileName, imageMode
     * 
     * @param {object} manifest json manifest object from photoshop api
     */
    setReportValuesBasedOnManifest(manifest){
        this.bitDepth = manifest.outputs[0].document.bitDepth
        this.width = manifest.outputs[0].document.width
        this.height = manifest.outputs[0].document.height
        this.iccProfileName = manifest.outputs[0].document.iccProfileName
        this.imageMode = manifest.outputs[0].document.imageMode
    }

    /****
     * set the values based on the aem asset data
     * 
     * @param {object} aemAssetData json object with aem asset data call response found in aemCscUtils
     */
    setValuesBasedOnAemAssetDataCall(aemAssetData){
        this.size = aemAssetData.body.aemImageData['jcr:content']['metadata']['dam:size']
    }

    getReportAsJson(){
        const report = {
            "artboardCount": this.artboardCount,
            "filename": this.filename,
            "aemFileName": this.aemFileName,
            "aemFilePath": this.aemFilePath,
            "aemFileUuid": this.aemFileUuid,    
            "artboardCountOk": this.artboardCountOk,
            "size": this.size,
            "sizeOk": this.sizeOk,
            "bitDepth": this.bitDepth,
            "width": this.width,
            "widthOk": this.widthOk,
            "height": this.height,
            "heightOk": this.heightOk,
            "iccProfileName": this.iccProfileName,
            "imageMode": this.imageMode,
            "status": this.status
        }
        return report
    }
}


module.exports = {
    AssetReportEngine
  }