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

    async cleanAssetReportData() {
        const fileLib = await this.getFileLib()
        await Files.delete(this.storagePath);
    }

    /*****
     * get the asset report object for use with the engine
     */
    getNewAssetReport() {
        const filename = `${Date.now()}-${Math.floor(Math.random() * 1000)}-asset-report.json` //randomize the filename
        this.currentAssetReport = new AssetReport(filename)
        return this.currentAssetReport
    }

    /*****
     * save the asset report to the storage
     * 
     * @param {AssetReport} report asset report object
     */
    async saveAssetReport(report) {
        const fileLib = await this.getFileLib()
        await fileLib.write(`${this.storagePath}${report.filename}`, report);
    }

    /*****
     * If you create a new asset report object, you can save it with this function
     */
    async saveCurrentAssetReport() {
        await this.saveAssetReport(this.currentAssetReport)
    }
}

const AssetReport = class{
    constructor(filename){
      this._filename = filename
      this._artboardCount = 0
      this._bitDepth = 'na'
      this._size = 0
      // 5. width and height < 8k
      this._width = 0
      // 5. width and height < 8k
      this._height = 0
      this._iccProfileName = 0
      this._imageMode = 'na'
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
    
    /******** QA Rules ********/
    /****
     * set the artboard count
     * 
     * @param {object} manifest json manifest object from photoshop api
     */
    setArtboardCount(manifest){
        this.artboardCount = this.numberOfArtBoardsInManifest(manifest)
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
            //"artboardCount": this.artboardCount,
            //"artboardCountOk": this.artboardCountOk,
            //"size": this.size,
            //"sizeOk": this.sizeOk,
            //"bitDepth": this.bitDepth,
            //"width": this.width,
            //"widthOk": this.widthOk,
            //"height": this.height,
            //"heightOk": this.heightOk,
            //"iccProfileName": this.iccProfileName,
            //"imageMode": this.imageMode,
            "status": this.status
        }
        return report
    }
}


module.exports = {
    AssetReportEngine
  }