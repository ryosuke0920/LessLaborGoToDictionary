(()=>{
	const LINK_NODE_DEFAULT_HEIGHT = 200;
	const LINK_NODE_DEFAULT_WIDTH = 280;
	const LINK_NODE_MIN_HEIGHT = 50;
	const LINK_NODE_MIN_WIDTH = 50;
	const LINK_NODE_PADDING = 3;
	const SPACE = 10;
	const SCROLL_BAR_WIDTH = 22;
	const ANCHOR_DEFAULT_SIZE = 0.8;
	const ANCHOR_MAX_SIZE = 2;
	const ANCHOR_MIN_SIZE = 0.6;
	const ANCHOR_RESIO = 0.1;
	const SILENT_ERROR_PREFIX = "[silent]";
	const SILENT_ERROR_REGEX = new RegExp( /^\[silent\]/ );
	const REMOVE_SPACE_REGEX = new RegExp( /(?:\s|\r|\n|\t|\||:)+/, "g" );
	const API_QUERY_DERAY = 500;
	const LINK_LIST_CLOSE_TIME = 500;
	const FOOTER_CONTENT = "Provided by Wiktionary under Creative Commons Attribution-Share Alike 3.0";//https://www.mediawiki.org/wiki/API:Licensing
	let linkListNode;
	let linkListNodeTop = 0;
	let linkListNodeLeft = 0;
	let linkListNodeHeight = LINK_NODE_DEFAULT_HEIGHT;
	let linkListNodeWidth = LINK_NODE_DEFAULT_WIDTH;
	let linkListScrollTopTmp = 0;
	let linkListScrollleftTmp = 0;
	let linkListAction = LINK_LIST_ACTION_MOUSECLICK;
	let coverNode;
	let optionList = [];
	let linkListFlag = false;
	let shiftKeyFlag = false;
	let ctrlKeyFlag = false;
	let resizeWatcherFlag = false;
	let anchorSize = ANCHOR_DEFAULT_SIZE;
	let menuNode;
	let containerNode;
	let apiContentNode;
	let apiTitleNode;
	let apiBodyNode;
	let mousedownFlag = false;
	let selectionChangedFlag = false;
	let faviconCache = {};
	let apiRequestQueue = {};
	let fetchRequestID = (()=>{ let id = 0; return ()=>{return ++id}	})();
	let serviceCode = API_SERVICE_CODE_NONE;
	let languageFilter = [];
	let apiCutOut = true;
	let apiFooterNode;

	Promise.resolve()
		.then(init)
		.then(
			()=>{ return Promise.resolve().then(loadSetting).then(addCommonLinkListEvents); },
			silentError
		).catch(unexpectedError);

	function init(){
		let body = document.querySelector("body");
		if( !body ){
			/* break promise chain, but not need notification. */
			throw( new Error( SILENT_ERROR_PREFIX + " not found body") );
		}
		linkListNode = document.createElement("div");
		linkListNode.setAttribute("id",CSS_PREFIX+"-viewer");
		hide(linkListNode);
		linkListNode.style.padding = LINK_NODE_PADDING + "px";
		applyLinkListSize();
		body.appendChild( linkListNode );
		coverNode = document.createElement("div");
		coverNode.setAttribute("id",CSS_PREFIX+"-cover");
		linkListNode.appendChild(coverNode);
		menuNode = document.createElement("nav");
		menuNode.setAttribute("id",CSS_PREFIX+"-menu");
		linkListNode.appendChild(menuNode);
		let linkListGridNode = document.createElement("div");
		linkListGridNode.setAttribute("id",CSS_PREFIX+"-grid");
		linkListNode.appendChild(linkListGridNode);
		containerNode = document.createElement("ul");
		containerNode.setAttribute("id",CSS_PREFIX+"-container");
		linkListGridNode.appendChild(containerNode);
		apiContentNode = document.createElement("div");
		apiContentNode.setAttribute("id",CSS_PREFIX+"-apiContent");
		linkListGridNode.appendChild(apiContentNode);
		let apiHeaderNode = document.createElement("div");
		apiHeaderNode.setAttribute("id",CSS_PREFIX+"-apiHeader");
		apiContentNode.appendChild(apiHeaderNode);
		apiTitleNode = document.createElement("a");
		apiTitleNode.setAttribute("id",CSS_PREFIX+"-apiTitle");
		apiTitleNode.setAttribute("rel","noreferrer");
		apiTitleNode.setAttribute("target","_blank");
		apiHeaderNode.appendChild(apiTitleNode);
		let apiLoadingNode = document.createElement("div");
		apiLoadingNode.setAttribute("id",CSS_PREFIX+"-apiLoading");
		apiContentNode.appendChild(apiLoadingNode);
		let apiLoadingContentNode = document.createElement("div");
		apiLoadingContentNode.setAttribute("id",CSS_PREFIX+"-apiLoadingContent");
		apiLoadingNode.appendChild(apiLoadingContentNode);
		apiBodyNode = document.createElement("div");
		apiBodyNode.setAttribute("id",CSS_PREFIX+"-apiBody");
		apiContentNode.appendChild(apiBodyNode);
		apiFooterNode = document.createElement("div");
		apiFooterNode.setAttribute("id",CSS_PREFIX+"-apiFooter");
		apiFooterNode.innerText = FOOTER_CONTENT;
		apiContentNode.appendChild(apiFooterNode);
		clearApiContent();
		let resizeNode = document.createElement("img");
		resizeNode.src = ponyfill.extension.getURL("/image/resize.svg");
		resizeNode.setAttribute("id",CSS_PREFIX+"-resize");
		resizeNode.title = ponyfill.i18n.getMessage("htmlResize");
		menuNode.appendChild(resizeNode);
		let zoomDownNode = document.createElement("img");
		zoomDownNode.src = ponyfill.extension.getURL("/image/minus.svg");
		zoomDownNode.setAttribute("id",CSS_PREFIX+"-zoomDown");
		zoomDownNode.title = ponyfill.i18n.getMessage("htmlZoomDown");
		menuNode.appendChild(zoomDownNode);
		let zoomUpNode = document.createElement("img");
		zoomUpNode.src = ponyfill.extension.getURL("/image/plus.svg");
		zoomUpNode.setAttribute("id",CSS_PREFIX+"-zoomUp");
		zoomUpNode.title = ponyfill.i18n.getMessage("htmlZoomUp");
		menuNode.appendChild(zoomUpNode);
		let copyNode = document.createElement("img");
		copyNode.src = ponyfill.extension.getURL("/image/copy.svg");
		copyNode.setAttribute("id",CSS_PREFIX+"-copy");
		copyNode.title = ponyfill.i18n.getMessage("htmlCopy");
		menuNode.appendChild(copyNode);
		let optionNode = document.createElement("img");
		optionNode.src = ponyfill.extension.getURL("/image/option.svg");
		optionNode.setAttribute("id",CSS_PREFIX+"-option");
		optionNode.title = ponyfill.i18n.getMessage("htmloption");
		menuNode.appendChild(optionNode);
	}

	function addCommonLinkListEvents(){
		ponyfill.storage.onChanged.addListener( onStorageChanged );
		menuNode.addEventListener("click", menuClickBihavior);
		document.addEventListener("keydown", keydownBehavior);
		document.addEventListener("mousemove", mousemoveBehavior);
		document.addEventListener("mouseup", mouseupCommonBehavior);
		document.addEventListener("mousedown", mousedownCommonBehavior);
		ponyfill.runtime.onMessage.addListener( notify );
	}

	function addAutoLinkListEvents(){
		document.addEventListener("selectionchange", selectionChangeAutoBehavior);
		document.removeEventListener("selectionchange", manualSelectionChangeBehavior);
		document.addEventListener("mouseup", mouseupAutoBehavior);
		document.addEventListener("mousedown", mousedownAutoBehavior);
	}

	function removeAutoLinkListEvents(){
		document.removeEventListener("selectionchange", selectionChangeAutoBehavior);
		document.addEventListener("selectionchange", manualSelectionChangeBehavior);
		document.removeEventListener("mouseup", mouseupAutoBehavior);
		document.removeEventListener("mousedown", mousedownAutoBehavior);
	}

	function manualSelectionChangeBehavior(e){
		closeLinkList();
		abortApiRequestQueue();
	}

	function selectionChangeAutoBehavior(e){
		selectionChangedFlag = true;
		if(mousedownFlag) return;
		let selection = window.getSelection();
		if( selection.isCollapsed ){
			closeLinkList();
			abortApiRequestQueue();
		}
		else {
			makeLinkList(selection.toString());
			let lastRange = selection.getRangeAt(selection.rangeCount-1);
			let rectList = lastRange.getClientRects();
			let rect = rectList[rectList.length-1];
			showLinkListByClick(rect.bottom+window.scrollY, rect.right+window.scrollX, rect.bottom, rect.right, selection);
			if(serviceCode != API_SERVICE_CODE_NONE){
				abortApiRequestQueue();
				apiRequest(selection);
			}
		}
	}

	function mousedownCommonBehavior(e){
		if ( e.target != coverNode ) mousedownFlag = true;
	}

	function mousedownAutoBehavior(e){
		if( e.button != 0 ) return;
		if( !isLinkListNodeUnderMouse(e.pageY, e.pageX) ) {
			closeLinkList();
			abortApiRequestQueue();
		}
	}

	function mouseupCommonBehavior(e){
		mousedownFlag = false;
		if ( resizeWatcherFlag ) {
			resizeWatcherFlag = false;
			saveLinkListSize().catch(onSaveError);
		}
	}

	function mouseupAutoBehavior(e){
		if( e.button != 0 ) return;
		if( selectionChangedFlag && !isLinkListNodeUnderMouse(e.pageY,e.pageX) ){
			let selection = window.getSelection();
			if( !selection.isCollapsed ){
				selectionChangedFlag = false;
				makeLinkList(selection.toString());
				showLinkListByClick(e.pageY, e.pageX, e.clientY, e.clientX, selection);
				if(serviceCode != API_SERVICE_CODE_NONE){
					abortApiRequestQueue();
					apiRequest(selection);
				}
			}
		}
	}

	function keydownBehavior(e){
		if( e.key == "Escape" || e.key == "Esc"){
			closeLinkList();
			abortApiRequestQueue();
		}
		else if((shiftKeyFlag && e.key == "Shift")||(ctrlKeyFlag && e.key == "Control")){
			switchLinkList();
		}
	}

	function switchLinkList(){
		if(isLinkListShown() && !hasStopper()){
			closeLinkList();
			abortApiRequestQueue();
		}
		else if ( hasToShow() ) {
			let selection = window.getSelection();
			if( !selection.isCollapsed ){
				let lastRange = selection.getRangeAt(selection.rangeCount-1);
				let rectList = lastRange.getClientRects();
				let rect = rectList[rectList.length-1];
				makeLinkList(selection.toString());
				showLinkListByKey(rect.bottom+window.scrollY, rect.right+window.scrollX, rect.bottom, rect.right, selection);
				if(serviceCode != API_SERVICE_CODE_NONE) {
					abortApiRequestQueue();
					apiRequest(selection);
				}
			}
		}
	}

	function mousemoveBehavior(e){
		if ( !hasStopper() && isLinkListShown() && mousedownFlag ) resizeWatcher();
	}

	function isLinkListNodeUnderMouse(yy,xx){
		if( linkListNodeTop <= yy && yy < ( linkListNodeTop + linkListNode.offsetHeight )
		&& linkListNodeLeft <= xx && xx < ( linkListNodeLeft + linkListNode.offsetWidth ) ){
			return true;
		}
		return false;
	}

	function getLinkListHeight(){
		return linkListNode.offsetHeight - ( 2 * LINK_NODE_PADDING );
	}

	function getLinkListWidth(){
		return linkListNode.offsetWidth - ( 2 * LINK_NODE_PADDING );
	}

	function resizeWatcher(){
		switchWatchFlag()
	}

	function switchWatchFlag(){
		let height = getLinkListHeight();
		let width = getLinkListWidth();
		if ( linkListNodeHeight != height || linkListNodeWidth != width ){
			resizeWatcherFlag = true;
			if ( height < LINK_NODE_MIN_HEIGHT ) height = LINK_NODE_MIN_HEIGHT;
			if ( width < LINK_NODE_MIN_WIDTH ) width = LINK_NODE_MIN_WIDTH;
			linkListNodeHeight = height;
			linkListNodeWidth = width;
		}
	}

	function applyFaviconDisplay(res){
		if( res == LINK_LIST_FAVICON_ONLY ) {
			linkListNode.classList.add(CSS_PREFIX+"-mini");
		}
		else {
			linkListNode.classList.remove(CSS_PREFIX+"-mini");
		}
	}

	function applyLinknListDirection(res){
		if( res == LINK_LIST_DIRECTION_HORIZAONTAL ) {
			linkListNode.classList.add(CSS_PREFIX+"-inline");
		}
		else {
			linkListNode.classList.remove(CSS_PREFIX+"-inline");
		}
	}

	function applyLinknListSeparator(res){
		if( res == LINK_LIST_SEPARATOR_VERTICAL ) {
			linkListNode.classList.add(CSS_PREFIX+"-separator");
		}
		else {
			linkListNode.classList.remove(CSS_PREFIX+"-separator");
		}
	}

	function applyServiceCode(res){
		if( res == API_SERVICE_CODE_NONE ) {
			hide(apiContentNode);
		}
		else {
			show(apiContentNode);
		}
	}

	function saveLinkListSize(){
		return ponyfill.runtime.sendMessage({
			"method": "saveLinkListSize",
			"data": {
				"lh": linkListNodeHeight,
				"lw": linkListNodeWidth
			}
		});
	}

	function closeLinkList(){
		resetScrollTmp();
		hide(linkListNode);
	}

	function closeLinkListDelay(){
		window.setTimeout(closeLinkList, LINK_LIST_CLOSE_TIME);
	}

	function onClickAnchor(e){
		closeLinkListDelay();
		abortApiRequestQueue();
	}

	function onClickSaveHistory(e){
		saveHistory(e.currentTarget).catch(onSaveError);
	}

	function saveHistory(node){
		let data = {
			"method": "saveHistory",
			"data": {
				"text": node.getAttribute("data-text"),
				"fromURL": window.location.toString(),
				"fromTitle": document.title.toString(),
				"toURL": node.getAttribute("data-url"),
				"toTitle": node.getAttribute("data-label")
			}
		};
		return ponyfill.runtime.sendMessage(data);
	}

	function makeLinkList(text){
		let list = containerNode.querySelectorAll("."+CSS_PREFIX+"-list");
		for(let i=0; i<list.length; i++){
			let node = list[i];
			containerNode.removeChild(node);
		}
		clearApiContent();
		for(let i=0; i<optionList.length; i++){
			let item = optionList[i];
			let li = document.createElement("li");
			li.classList.add(CSS_PREFIX+"-list");
			li.setAttribute( "title", item["l"] );
			let url = item["u"];
			url = url.replace( "$1", encodeURIComponent(text) );
			let a = document.createElement("a");
			a.classList.add(CSS_PREFIX+"-anchor");
			a.setAttribute( "href", url );
			a.setAttribute( "target", "_blank" );
			a.setAttribute( "rel", "noreferrer" );
			a.setAttribute( "data-text", text );
			a.setAttribute( "data-url", item["u"] );
			a.setAttribute( "data-label", item["l"] );
			a.addEventListener("click", onClickAnchor);
			if( item["h"] ) a.addEventListener("click", onClickSaveHistory);
			let img = document.createElement("img");
			img.classList.add(CSS_PREFIX+"-favicon");
			let src;
			if( faviconCache.hasOwnProperty(item["u"]) && faviconCache[item["u"]] != FAVICON_NODATA ){
				src = faviconCache[item["u"]];
			}
			else {
				src = ponyfill.extension.getURL("/image/favicon.svg");
			}
			img.setAttribute( "src", src );
			setFaviconSize(img, anchorSize);
			a.appendChild(img);
			let span = document.createElement("span");
			span.classList.add(CSS_PREFIX+"-label");
			setFontSize(span, anchorSize);
			span.innerText = item["l"];
			a.appendChild(span);
			li.appendChild(a);
			containerNode.appendChild(li);
		}
	}

	function applyLinkListSize(){
		linkListNode.style.height = linkListNodeHeight + "px";
		linkListNode.style.width = linkListNodeWidth + "px";
	}

	function showLinkListByClick(pageY, pageX, clientY, clientX, selection){
		if( linkListAction == LINK_LIST_ACTION_MOUSECLICK || linkListAction == LINK_LIST_ACTION_MOUSEOVER ) addStopper();
		showLinkList(pageY, pageX, clientY, clientX, selection);
	}

	function showLinkListByKey(pageY, pageX, clientY, clientX, selection){
		removeStopper();
		showLinkList(pageY, pageX, clientY, clientX, selection);
	}

	function showLinkList(pageY, pageX, clientY, clientX, selection){
		/* when display equals none, offsetHeight and offsetWidth return undefined. */
		show(linkListNode);
		applyLinkListSize();
		let yy = window.innerHeight - clientY - linkListNode.offsetHeight - SCROLL_BAR_WIDTH;
		if ( 0 < yy || window.innerHeight < linkListNode.offsetHeight ) yy = 0;
		let xx = window.innerWidth - clientX - linkListNode.offsetWidth - SCROLL_BAR_WIDTH;
		if ( 0 < xx || window.innerWidth < linkListNode.offsetWidth ) xx = 0;
		linkListNodeTop = pageY + yy + SPACE;
		linkListNodeLeft = pageX + xx + SPACE;
		/*
		let lastRange = selection.getRangeAt(selection.rangeCount-1);
		let rectList = lastRange.getClientRects();
		let rect = rectList[rectList.length-1];
		if ( window.scrollY + rect.top < linkListNodeTop + linkListNode.offsetHeight && linkListNodeTop < window.scrollY + rect.bottom ){
			if ( window.scrollX + rect.left < linkListNodeLeft + linkListNode.offsetWidth && linkListNodeLeft < window.scrollX + rect.right ){
				linkListNodeTop = window.scrollY + rect.top - linkListNode.offsetHeight - SPACE;
			}
		}
		*/
		if ( linkListNodeTop < window.scrollY ) linkListNodeTop = window.scrollY;
		if ( linkListNodeLeft < window.scrollX ) linkListNodeLeft = window.scrollX;
		linkListNode.style.top = linkListNodeTop+"px";
		linkListNode.style.left = linkListNodeLeft+"px";
		linkListNode.scrollTop = 0;
		linkListNode.scrollLeft = 0;
	}

	function isLinkListShown(){
		return !linkListNode.classList.contains(CSS_PREFIX+"-hide");
	}

	function onStorageChanged(change, area){
		if( change["lh"] || change["lw"] ){
			let lh = linkListNodeHeight;
			if( change.hasOwnProperty("lh") ) lh = change["lh"]["newValue"];
			let lw = linkListNodeWidth;
			if( change.hasOwnProperty("lw") ) lw = change["lw"]["newValue"];
			setLinkListSize( lh, lw );
		}
		if( change["as"] ){
			setAnchorSize( change["as"]["newValue"] );
		}
		if( change["ck"] ){
			setCtrlKeyFlag( change["ck"]["newValue"] );
		}
		if( change["sk"] ){
			setShiftKeyFlag( change["sk"]["newValue"] );
		}
		if( change["ol"] ) {
			closeLinkList();
			abortApiRequestQueue();
			setOptionList( change["ol"]["newValue"] );
			resetLinkListEvents();
			if(hasLinkList()) getFavicon().then( gotFavicon ).catch((e)=>{console.error(e);});
		}
		if( change["bf"] ){
			closeLinkList();
			abortApiRequestQueue();
			setLinkListFlag( change["bf"]["newValue"] );
			resetLinkListEvents();
		}
		if( change["cl"] ){
			setLinkListStyle( change["cl"]["newValue"] );
		}
		if( change["ca"] ){
			setLinkListAction( change["ca"]["newValue"] );
		}
		if( change["f"] ){
			applyFaviconDisplay( change["f"]["newValue"] );
		}
		if( change["ld"] ){
			applyLinknListDirection( change["ld"]["newValue"] );
		}
		if( change["ls"] ){
			applyLinknListSeparator( change["ls"]["newValue"] );
		}
		if( change["s"] ){
			closeLinkList();
			abortApiRequestQueue();
			setServiceCode( change["s"]["newValue"] );
			applyServiceCode( change["s"]["newValue"] );
			resetLinkListEvents();
		}
		if( change["ll"] ){
			setLanguageFilter( change["ll"]["newValue"] );
		}
		if( change["co"] ){
			setLinkListApiCutOut( change["co"]["newValue"] );
		}
	}

	function setLinkListSize( height=LINK_NODE_DEFAULT_HEIGHT, width=LINK_NODE_DEFAULT_WIDTH ){
		linkListNodeHeight = height;
		linkListNodeWidth = width;
		if( isLinkListShown() ) applyLinkListSize();
	}

	function loadSetting(){
		let serviceCode = getUiLang();
		if( !API_SERVICE.hasOwnProperty(serviceCode) ) serviceCode = DEFAULT_LOCALE;
		let service = API_SERVICE[serviceCode];
		let languageFilter = API_SERVICE_PROPERTY[service].defaultLanguage;
		let getter = ponyfill.storage.sync.get({
			"ol": [],
			"bf": true,
			"sk": false,
			"ck": false,
			"lh": LINK_NODE_DEFAULT_HEIGHT,
			"lw": LINK_NODE_DEFAULT_WIDTH,
			"as": ANCHOR_DEFAULT_SIZE,
			"cl": LINK_LIST_STYLE_DARK,
			"ca": LINK_LIST_ACTION_MOUSECLICK,
			"f": LINK_LIST_FAVICON_ONLY,
			"ld": LINK_LIST_DIRECTION_VERTICAL,
			"ls": LINK_LIST_SEPARATOR_VERTICAL,
			"s": serviceCode,
			"ll": languageFilter,
			"co": true
		});
		return getter.then(setVer, onReadError);
	}

	function getUiLang(){
		let lang = ponyfill.i18n.getUILanguage();
		let matcher = lang.match(/^([a-zA-Z0-9]+)\-[a-zA-Z0-9]+$/);
		if( matcher ){
			lang = matcher[1];
		}
		return lang;
	}

	function setVer( res ){
		setAnchorSize( res["as"] );
		setLinkListSize( res["lh"], res["lw"] );
		setOptionList( res["ol"] );
		setLinkListFlag( res["bf"] );
		setCtrlKeyFlag( res["ck"] );
		setShiftKeyFlag( res["sk"] );
		setLinkListStyle( res["cl"] );
		setLinkListAction( res["ca"] );
		applyFaviconDisplay( res["f"] );
		applyLinknListDirection( res["ld"] );
		applyLinknListSeparator( res["ls"] );
		setServiceCode( res["s"] );
		applyServiceCode( res["s"] );
		setLanguageFilter( res["ll"] );
		setLinkListApiCutOut( res["co"] );
		resetLinkListEvents();
		if(hasLinkList()) getFavicon().then( gotFavicon ).catch((e)=>{console.error(e);});
	}

	function setAnchorSize(res){
		anchorSize = res;
		applyZoomLinkList();
	}

	function setLinkListFlag(res){
		linkListFlag = res;
	}

	function setShiftKeyFlag(res){
		shiftKeyFlag = res;
	}

	function setCtrlKeyFlag(res){
		ctrlKeyFlag = res;
	}

	function setServiceCode(res){
		serviceCode = res;
	}

	function setLanguageFilter(res){
		languageFilter = res;
	}

	function setLinkListApiCutOut(res){
		apiCutOut = res;
	}

	function setLinkListStyle(res){
		linkListNode.classList.remove(CSS_PREFIX+"-dark");
		if( res == LINK_LIST_STYLE_DARK ) linkListNode.classList.add(CSS_PREFIX+"-dark");
	}

	function setLinkListAction(res){
		linkListAction = res;
		resetScrollTmp();
		linkListNode.classList.remove(CSS_PREFIX+"-mouseover");
		linkListNode.classList.remove(CSS_PREFIX+"-mouseclick");
		removeStopper();
		linkListNode.removeEventListener("mouseenter", removeStopper);
		linkListNode.removeEventListener("mouseleave", controlStopper);
		linkListNode.removeEventListener("click", removeStopper);
		if( linkListAction == LINK_LIST_ACTION_MOUSEOVER ){
			linkListNode.classList.add(CSS_PREFIX+"-mouseover");
			addStopper();
			linkListNode.addEventListener("mouseenter", removeStopper);
			linkListNode.addEventListener("mouseleave", controlStopper);
		}
		else if( linkListAction == LINK_LIST_ACTION_MOUSECLICK ) {
			linkListNode.classList.add(CSS_PREFIX+"-mouseclick");
			addStopper();
			linkListNode.addEventListener("click", removeStopper);
		}
	}

	function controlStopper(e){
		if(!resizeWatcherFlag){
			addStopper();
			linkListScrollTopTmp = linkListNode.scrollTop;
			linkListScrollleftTmp = linkListNode.scrollLeft;
			linkListNode.scrollTop = linkListNode.scrollLeft = 0;
		}
	}

	function addStopper(){
		linkListNode.classList.add(CSS_PREFIX+"-stopper");
	}

	function removeStopper(e){
		linkListNode.scrollTop = linkListScrollTopTmp;
		linkListNode.scrollLeft = linkListScrollleftTmp;
		linkListNode.classList.remove(CSS_PREFIX+"-stopper");
	}

	function hasStopper(){
		return linkListNode.classList.contains(CSS_PREFIX+"-stopper");
	}

	function resetScrollTmp(){
		linkListScrollTopTmp = linkListScrollleftTmp = 0;
	}

	function resetLinkListEvents(){
		removeAutoLinkListEvents();
		if( linkListFlag && hasToShow() ) addAutoLinkListEvents();
	}

	function setOptionList(res){
		optionList = [];
		for(let i=0; i<res.length; i++){
			let data = res[i];
			if ( data["c"] ) optionList.push(data);
		}
	}

	function getFavicon(){
		return ponyfill.runtime.sendMessage({
			"method": "getFavicon",
		});
	}

	function gotFavicon(e){
		faviconCache = e;
	}

	function hasToShow(){
		return (hasLinkList() || hasServiceCode());
	}

	function hasLinkList(){
		if( optionList.length > 0 ) return true;
		return false;
	}

	function hasServiceCode(){
		return (serviceCode != API_SERVICE_CODE_NONE);
	}

	function menuClickBihavior(e){
		let id = e.target.getAttribute("id");
		if(id == CSS_PREFIX+"-zoomUp"){
			if( zoomLinkList(1) ){
				saveAnchorSize().catch(onSaveError);
			}
		}
		else if(id == CSS_PREFIX+"-zoomDown"){
			if( zoomLinkList(-1) ){
				saveAnchorSize().catch(onSaveError);
			}
		}
		else if(id == CSS_PREFIX+"-copy"){
			copyText().then(closeLinkList).then(abortApiRequestQueue);
		}
		else if(id == CSS_PREFIX+"-resize"){
			resetSize(LINK_NODE_DEFAULT_HEIGHT, LINK_NODE_DEFAULT_WIDTH);
			saveLinkListSize().catch(onSaveError);
		}
		else if(id == CSS_PREFIX+"-option"){
			ponyfill.runtime.sendMessage({"method": "openOptions"}).then(closeLinkList).then(abortApiRequestQueue);
		}
	}

	function copyText(){
		document.execCommand("copy");
		return ponyfill.runtime.sendMessage({
			"method": "notice",
			"data": ponyfill.i18n.getMessage("notificationCopyed")
		});
	}

	function resetSize(height,width){
		linkListNodeHeight = height;
		linkListNodeWidth = width;
		applyLinkListSize();
	}

	function zoomLinkList(direction=1){
		if ( direction < 0 && anchorSize <= ANCHOR_MIN_SIZE ) return false;
		if ( 0 < direction && ANCHOR_MAX_SIZE <= anchorSize ) return false;
		anchorSize += direction * ANCHOR_RESIO;
		anchorSize = truncNumber(anchorSize);
		applyZoomLinkList();
		return true;
	}

	function truncNumber(num){
		num += 0.01;
		num *= 10 ;
		num = Math.floor(num);
		num /= 10 ;
		return num
	}

	function applyZoomLinkList(){
		let list = linkListNode.querySelectorAll("span."+CSS_PREFIX+"-label");
		for(let i=0; i<list.length; i++){
			setFontSize(list[i], anchorSize);
		}
		list = linkListNode.querySelectorAll("img."+CSS_PREFIX+"-favicon");
		for(let i=0; i<list.length; i++){
			setFaviconSize(list[i], anchorSize);
		}
	}

	function setFontSize(node, size){
		node.style["font-size"] = size + "em";
	}

	function setFaviconSize(node, size){
		size = truncNumber(size + (2*ANCHOR_RESIO));
		node.style["height"] = size + "em";
		node.style["width"] = size + "em";
	}

	function saveAnchorSize(){
		let res = ponyfill.runtime.sendMessage({
			"method": "saveAnchorSize",
			"data": {
				"as": anchorSize
			}
		});
		return res;
	}

	function onSaveError(e){
		console.error(e);
		let res = ponyfill.runtime.sendMessage({
			"method": "notice",
			"data": ponyfill.i18n.getMessage("notificationSaveOptionError", [e.message])
		});
		return res;
	}

	function onReadError(e){
		console.error(e);
		let res = ponyfill.runtime.sendMessage({
			"method": "notice",
			"data": ponyfill.i18n.getMessage("notificationReadOptionError", [e.message])
		});
		return res;
	}

	function unexpectedError(e){
		console.error(e);
		let res = ponyfill.runtime.sendMessage({
			"method": "notice",
			"data": ponyfill.i18n.getMessage("notificationUnexpectedError", [e.message])
		});
		return res;
	}

	function silentError(e){
		if( e.message.match( SILENT_ERROR_REGEX ) ){
			console.log(e);
		}
		else {
			throw(e);
		}
	}

	function notify(e){
		if(e.method == "updateFaviconCache") {
			faviconCache = e.data;
		}
	}

	function apiRequest(selection){
		let id = fetchRequestID();
		let text = selection.toString().replace(REMOVE_SPACE_REGEX," ").trim();
		let obj = {
			"id": id,
			"abort": false,
			"data": {
				"text": text,
				"api": "wiktionary"
			}
		};
		apiRequestQueue[id] = obj;
		let keyList = Object.keys(apiRequestQueue);
		if(keyList.length<=1) {
			linkListNode.classList.add(CSS_PREFIX+"-loading");
			apiTitleNode.innerText = "Now loading"; // TODO
			apiTitleNode.removeAttribute("href");
			apiRequestStart(obj);
			return;
		}
		setTimeout((e)=>{
			if( !isActiveApiRequestQueue(obj) ){
				dropApiRequestQueue(obj);
				return;
			}
			apiRequestStart(obj);
		}, API_QUERY_DERAY);
	}

	function apiRequestStart(obj){
		ponyfill.runtime.sendMessage({
			"method": "apiRequest",
			"data": obj.data
		}).then(
			apiResponse.bind(obj)
		).catch(
			apiResponseError.bind(obj)
		).finally(
			()=>{
				dropApiRequestQueue(obj)
			}
		);
	}

	function isActiveApiRequestQueue(obj){
		let keyList = Object.keys(apiRequestQueue);
		let selection = window.getSelection();
		return ( apiRequestQueue.hasOwnProperty(obj.id) && !obj.abort );
	}

	function dropApiRequestQueue(obj){
		delete apiRequestQueue[obj.id];
	}

	function abortApiRequestQueue(){
		let valueList = Object.values(apiRequestQueue);
		for(let i=0; i<valueList.length; i++){
			valueList[i].abort = true;
		}
	}

	function clearApiContent(){
		clearChildren(apiBodyNode);
	}

	function clearChildren(node){
		while(node.lastChild){
			node.removeChild(node.lastChild);
		}
	}

	function apiResponse(e){
		console.log(languageFilter);
		if( !isActiveApiRequestQueue(this) ) return;
		apiTitleNode.innerText = e.title;
		apiTitleNode.setAttribute("href", e.fullurl);
		let sections = [];
		if(languageFilter.length > 0){
			for(let i=0; i<e.html.length; i++){
				let div = document.createElement("div");
				div.innerHTML = e.html[i];
				for(let j=0; j<languageFilter.length; j++){
					let language = languageFilter[j];
					let followed = API_SERVICE_PROPERTY[e.service].followed;
					let regex = new RegExp("\\s+"+followed+"$","i");
					if (followed != null) language = language.replace(regex, "");
					let list = div.querySelectorAll(".section-heading");
					console.log(list);
					for(let k=0; k<list.length; k++){
						let target = list[k];
						if(language!=target.innerText) continue;
						let tagName = target.tagName;
						let tmp = [];
						tmp.push(target);
						while( target.nextElementSibling && !target.nextElementSibling.classList.contains("section-heading") ){
							tmp.push( target.nextElementSibling );
							target = target.nextElementSibling;
						}
						let content = document.createElement("div");
						for(let l=0; l<tmp.length; l++ ){
							content.appendChild(tmp[l]);
						}
						sections.push(content);
						break;
					}
				}
			}
		}
		else {
			for(let i=0; i<e.html.length; i++){
				let div = document.createElement("div");
				div.innerHTML = e.html[i];
				sections.push(div);
			}
		}
		console.log(sections);
		if(sections.lenght<=0){
			//TODO
			console.log("section not found.");
			return;
		}
		for(let i=0; i<sections.length; i++){
			let doc = sections[i];
			let content;
			let list;
			if(apiCutOut){
				content = doc.querySelector("ol");
			}
			else {
				content = doc;
				list = content.querySelectorAll("h1.in-block,h2.in-block,h3.in-block,h4.in-block,h5.in-block,h6.in-block");
				let reduceSections = API_SERVICE_PROPERTY[e.service].reduceSection;
				for(let i=0; i<list.length; i++){
					let node = list[i];
					let flag = false;
					for(let i=0; i<reduceSections.length; i++ ){
						if(node.innerText.match(reduceSections[i]) ){
							flag = true;
							break;
						}
					}
					if( flag ){
						while(node.nextElementSibling && !node.nextElementSibling.classList.contains("in-block")){
							node.nextElementSibling.remove();
						}
						node.remove();
					}
				}
			}
			list = content.querySelectorAll("[style]");
			for(let i=0; i<list.length; i++){
				list[i].style.float = "none";
				if( list[i].style.width ) list[i].style.width = "auto";
			}
			list = content.querySelectorAll("audio");
			for(let i=0; i<list.length; i++){
				list[i].style.width = "50px";
			}
			list = content.querySelectorAll("a[href]:not([href^=http])");
			for(let i=0; i<list.length; i++){
				let url = list[i].getAttribute("href");
				list[i].setAttribute("href", e.service + url);
			}
			list = content.querySelectorAll("a");
			for(let i=0; i<list.length; i++){
				list[i].setAttribute("target", "_blank");
				list[i].setAttribute("rel", "noreferrer");
			}
			list = content.querySelectorAll(".indicator,.noprint");
			for(let i=0; i<list.length; i++){
				list[i].parentNode.removeChild(list[i]);
			}
			apiBodyNode.appendChild(content);
		}
		linkListNode.classList.remove(CSS_PREFIX+"-loading");
	}

	function apiResponseError(e){
		console.error(e);
		if(!isActiveApiRequestQueue(this)) return;
		if(e instanceof Error ) {
			if(e.message == API_PAGE_NOT_FOUND){
				//TODO
			}
		}
		apiTitleNode.innerText = "Not Found."; // TODO
		apiTitleNode.removeAttribute("href");
		let content = createElement("p");
		apiBodyNode.appendChild(content);
		linkListNode.classList.remove(CSS_PREFIX+"-loading");
	}

	function show(node){
		node.classList.remove(CSS_PREFIX+"-hide");
	}

	function hide(node){
		node.classList.add(CSS_PREFIX+"-hide");
	}

})();
