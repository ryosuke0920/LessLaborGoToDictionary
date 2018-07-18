ponyfill.runtime.onInstalled.addListener( install ); /* call as soon as possible　*/
const DEFAULT_LOCALE = "en";
const XHR_TIMEOUT = 10000;
const MAX_FAVICON_CONNECTION = 5;
let optionList = [];
let autoViewFlag = true;
let shiftKey = false;
let ctrlKey = false;
let options = {};
let faviconCache = {};

Promise.resolve()
.then(getSetting)
.then(initContextMenu)
.then(initListener)
.catch(unexpectedError)
.then(updateFaviconCache)
.catch(err);

function install(e){
	if(e.reason == "install"){
		let data = {
			"ol": getDefaultOptionList()
		};
		return save(data)
		.then(getSetting)
		.then(initContextMenu)
		.catch(onSaveError)
		.then(updateFaviconCache)
		.catch(err);
	}
}
function initContextMenu(){
	return getSetting().then(resetMenu, onReadError);
}

function getSetting() {
	return ponyfill.storage.sync.get({
		"ol": [],
		"bf": true,
		"sk": false,
		"ck": false
	}).then(onGotSetting);
}

function onGotSetting(json){
	optionList = json["ol"];
	autoViewFlag = json["bf"];
	shiftKey = json["sk"];
	ctrlKey = json["ck"];
}

function initListener(){
	ponyfill.storage.onChanged.addListener( onStorageChanged );
	ponyfill.contextMenus.onClicked.addListener( contextMenuBehavior );
	ponyfill.runtime.onMessage.addListener(notify);
	ponyfill.browserAction.onClicked.addListener((e)=>{
		ponyfill.runtime.openOptionsPage();
	});
}

function openWindow( url, text){
	let promise = ponyfill.tabs.create({"url": makeURL(url,text)});
	return promise.catch(onOpenWindowError);
}

function notify(message, sender, sendResponse){
	let method = message.method;
	let data = message.data;
	if( method == "notice" ){
		return notice(data);
	}
	else if( method == "saveHistory" ){
		return saveHistory(data);
	}
	else if( method == "openOptions" ){
		return ponyfill.runtime.openOptionsPage();
	}
	else if( method == "getFavicon" ){
		return Promise.resolve(faviconCache);
	}
	else {
		return save(data);
	}
}

function saveAutoViewFlag(flag=true){
	return save({"bf":flag}).catch(onSaveError);
}

function saveManualViewShiftKey(flag=false){
	return save({"sk":flag}).catch(onSaveError);
}

function saveManualViewCtrlKey(flag=false){
	return save({"ck":flag}).catch(onSaveError);
}

function addHistory(e){
	let db = e.target.result;
	let transaction = db.transaction(["historys"], WRITE);
	let promise = new Promise((resolve,reject)=>{
		let historys = transaction.objectStore(HISTORYS);
		let req = historys.add(this.data);
		req.onsuccess = (e)=>{
			resolve(e);
		};
		req.onerror = (e)=>{
			reject(e);
		};
	});
	return promise;
}

function saveHistory(data){
	data.date = new Date();
	let obj = {"data": data};
	return Promise.resolve()
		.then(indexeddb.open.bind(indexeddb))
		.then(indexeddb.prepareRequest.bind(indexeddb))
		.then(addHistory.bind(obj));
}

function onStorageChanged(change, area){
	if(change["ol"] || change["bf"] || change["sk"] || change["ck"]) {
		if(change["ol"]) optionList = change["ol"]["newValue"];
		if(change["bf"]) autoViewFlag = change["bf"]["newValue"];
		if(change["sk"]) shiftKey = change["sk"]["newValue"];
		if(change["ck"]) ctrlKey = change["ck"]["newValue"];
		resetMenu();

	}
	if(change["ol"]) {
		updateFaviconCache().catch(err);
	};
}

function resetMenu(json){
	ponyfill.contextMenus.removeAll();
	options = {};
	for(let i=0; i<optionList.length; i++){
		let data = optionList[i];
		let checked = data["c"];
		let hist = data["h"];
		if ( checked ) {
			let id = (i+1).toString();
			let label = data["l"];
			let url = data["u"];
			let args = {
				"id": id,
				"title": label,
				"contexts": ["selection"]
			};
			options[id] = {
				"hist": hist,
				"url": url,
				"label": label
			}
			ponyfill.contextMenus.create(args);
		}
	}
	if( 0 < optionList.length ) {
		ponyfill.contextMenus.create({
			"type": "separator",
			"contexts": ["selection"]
		});
	}
	ponyfill.contextMenus.create({
		"id": "autoView",
		"title": ponyfill.i18n.getMessage("extensionOptionAutoView"),
		"checked": autoViewFlag,
		"type": "checkbox",
		"contexts": ["page","selection"]
	});
	ponyfill.contextMenus.create({
		"id": "manualView",
		"title": ponyfill.i18n.getMessage("extensionOptionManualView"),
		"contexts": ["page","selection"]
	});
	ponyfill.contextMenus.create({
		"parentId": "manualView",
		"id": "manualViewShiftKey",
		"title": ponyfill.i18n.getMessage("extensionOptionManualViewByShiftKey"),
		"checked": shiftKey,
		"type": "checkbox",
		"contexts": ["page","selection"]
	});
	ponyfill.contextMenus.create({
		"parentId": "manualView",
		"id": "manualViewCtrlKey",
		"title": ponyfill.i18n.getMessage("extensionOptionManualViewByCtrlKey"),
		"checked": ctrlKey,
		"type": "checkbox",
		"contexts": ["page","selection"]
	});
	ponyfill.contextMenus.create({
		"id": "option",
		"title": ponyfill.i18n.getMessage("extensionOptionName"),
		"contexts": ["page","selection"]
	});
}

function contextMenuBehavior(info, tab){
	let promise;
	if ( info.menuItemId == "option" ){
		promise = ponyfill.runtime.openOptionsPage();
	}
	else if ( info.menuItemId == "autoView" ){
		saveAutoViewFlag(info.checked);
	}
	else if ( info.menuItemId == "manualViewShiftKey" ){
		saveManualViewShiftKey(info.checked);
	}
	else if ( info.menuItemId == "manualViewCtrlKey" ){
		saveManualViewCtrlKey(info.checked);
	}
	else if ( options.hasOwnProperty( info.menuItemId ) ){
		openWindow(options[info.menuItemId]["url"], info.selectionText );
		if( options[info.menuItemId]["hist"] ){
			saveHistory({
				"text": info.selectionText,
				"fromURL": tab.url.toString(),
				"fromTitle": tab.title.toString(),
				"toURL": options[info.menuItemId]["url"],
				"toTitle": options[info.menuItemId]["label"]
			}).catch( onSaveError );
		}
	}
}

function getDefaultOptionList(){
	let lang = ponyfill.i18n.getUILanguage();
	let matcher = lang.match(/^([a-zA-Z0-9]+)\-[a-zA-Z0-9]+$/);
	if( matcher ){
		lang = matcher[1];
	}
	if ( lang && DEFAULT_OPTION_LIST[lang] ) {
		return DEFAULT_OPTION_LIST[lang];
	}
	lang = ponyfill.runtime.getManifest()["default_locale"];
	if ( lang && DEFAULT_OPTION_LIST[lang] ) {
		return DEFAULT_OPTION_LIST[lang];
	}
	return DEFAULT_OPTION_LIST[DEFAULT_LOCALE];
}

function convertFaviconURL(url){
	return remainDomainURL(url) + "favicon.ico";
}

function remainDomainURL(url){
	let newURL = "";
	let count = 0;
	for(let i=0; i<url.length; i++){
		let str = url.substr(i,1);
		newURL += str;
		if(str == "/") count++;
		if(3 <= count) break;
	}
	if(count < 3) newURL += "/";
	return newURL;
}

function promiseAjax(method="GET", url, responseType){
	return new Promise((resolve, reject)=>{
		let xhr = new XMLHttpRequest();
		xhr.addEventListener("load", (e)=>{
			resolve(e);
		});
		xhr.addEventListener("error", (e)=>{
			console.error(e);
			reject(e);
		});
		xhr.addEventListener("abort", (e)=>{
			console.error(e);
			reject(e);
		});
		xhr.addEventListener("timeout", (e)=>{
			console.error(e);
			reject(e);
		});
		console.log(url);
		xhr.open(method, url);
		xhr.timeout = XHR_TIMEOUT;
		if(responseType) xhr.responseType = responseType;
		xhr.send();
	});
}

function updateFaviconCache(){
	return new Promise((resolve)=>{
		let queue = [];
		for(let i=0; i<optionList.length; i++){
			let obj = optionList[i];
			if(!obj.c) continue;
			if(faviconCache.hasOwnProperty(obj.u)) continue;
			faviconCache[obj.u] = FAVICON_NODATA;
			let faviconURL = convertFaviconURL(obj.u);
			let data = {
					"url": obj.u,
					"faviconURL": [faviconURL],
					"requestIndex": 0,
					"blob": null,
					"base64": null,
					"doc": null
			};
			queue.push(data);
		}
		let queue_length = queue.length;
		let count = (()=>{
			let i=0;
			return ()=>{
				return ++i;
			}
		})();
		for(let i=0; i<MAX_FAVICON_CONNECTION; i++){
			let data = queue.shift();
			if(!data) break;
			let obj = {
				"connection_id": i,
				"queue_id": queue.length+1,
				"queue_length": queue_length,
				"count": count,
				"callback": resolve,
				"queue": queue,
				"promise": Promise.resolve(),
				"data": data
			};
			faviconChain.bind(obj)();
		}
	});
}

function faviconChain(){
	this.promise = this.promise
	.then( requestAjaxSearchURL.bind(this) )
	.then( responseAjaxSearchURL.bind(this) )
	.catch( err )
	.then( decideFaviconURL.bind(this) )
	.then( requestAjaxFavicon.bind(this) )
	.then( responseAjaxFavicon.bind(this) )
	.then( convertFavicon.bind(this) )
	.then( setFaviconCache.bind(this) )
	.catch( err )
	.finally( endOfFaviconChain.bind(this) );
	return this.promise;
}

function requestAjaxSearchURL(){
	return promiseAjax("GET", this.data.url, "document");
}

function responseAjaxSearchURL(e){
	if( e.target.response ) { // if it's not document, it's null.
		this.data.doc = e.target.response;
		return;
	}
	console.log("not found:"+e.target.responseURL);
}

function decideFaviconURL(e){
	if(!this.data.doc) return;
	let node = this.data.doc.querySelector("link[rel~=icon]");
	if(!node) return;
	let url = node.href;
	if(!url) return;
	this.data.faviconURL.unshift(url);
}

function requestAjaxFavicon(){
	return promiseAjax("GET", this.data.faviconURL[this.data.requestIndex], "blob");
}

function responseAjaxFavicon(e){
	if(e.target.status == "200"){
		this.data.blob = e.target.response;
		return;
	}
	console.log("not found:"+e.target.responseURL);
	if( ++this.data.requestIndex >= this.data.faviconURL.length ) return;
	return Promise.resolve()
	.then( requestAjaxFavicon.bind(this) )
	.then( responseAjaxFavicon.bind(this) )
}

function convertFavicon(){
	return new Promise((resolve,reject)=>{
		if(!this.data.blob){
			resolve();
			return;
		}
		let reader = new FileReader();
		reader.readAsDataURL(this.data.blob);
		reader.onloadend = (e)=>{
			this.data.base64 = reader.result;
			resolve();
		}
		reader.onerror = (e)=>{
			console.error(e);
			reject(e);
		}
		reader.onabort = (e)=>{
			console.error(e);
			reject(e);
		}
	});
}

function setFaviconCache(){
	if(this.data.base64) faviconCache[this.data.url] = this.data.base64;
}

function endOfFaviconChain(){
	let count = this.count();
	this.data = this.queue.shift();
	if(!this.data) {
		if( count >= this.queue_length  ){
			this.callback();
		}
		return;
	}
	this.queue_id = this.queue.length + 1;
	faviconChain.bind(this)();
}
