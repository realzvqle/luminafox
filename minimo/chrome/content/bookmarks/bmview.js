function bmInit(targetDoc, targetElement) {

	var testLoad=new bmProcessor();
	testLoad.xslSet("bookmark_template.xml");
	testLoad.setTargetDocument(targetDoc);
	testLoad.setTargetElement(targetElement);
	testLoad.run();

}

/* This is called and currently being used from minimo.js, 
 * See the path bookmarks/... 
 */
function bmInitXUL(targetDoc, targetElement) {

    var testLoad=new bmProcessor();
    testLoad.xslSet("bookmarks/bookmark_template_xul.xml");
    testLoad.setTargetDocument(targetDoc);
    testLoad.setTargetElement(targetElement);
    testLoad.run();
    
}

function bmProcessor() {
	this.xmlRef=document.implementation.createDocument("","",null);
	this.xslRef=document.implementation.createDocument("http://www.w3.org/1999/XSL/Transform","stylesheet",null);

	var bookmarkStore=null;

	try {
	      gPref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	      bookmarkStore = gPref.getCharPref("browser.bookmark.store");
     
      } catch (ignore) {}


	var aDOMParser = new DOMParser();
	this.xmlRef = aDOMParser.parseFromString(bookmarkStore,"text/xml");

	if(this.xmlRef&&this.xmlRef.firstChild&&this.xmlRef.firstChild.nodeName=="bm") {

		// All good to go. 
		
	} else {
		var bookmarkEmpty="<bm></bm>";
		gPref.setCharPref("browser.bookmark.store",bookmarkEmpty);
		this.xmlRef = aDOMParser.parseFromString(bookmarkEmpty,"text/xml");
	}

	this.xslUrl="";

	var myThis=this;
	var omega=function thisScopeFunction2() { myThis.xslLoaded(); }

	this.xslRef.addEventListener("load",omega,false);

	this.xmlLoadedState=true;
	this.xslLoadedState=false;


}

bmProcessor.prototype.xmlLoaded = function () {
	this.xmlLoadedState=true;	
	this.apply();
}

bmProcessor.prototype.xslLoaded = function () {
	this.xslLoadedState=true;
	this.apply();
}

bmProcessor.prototype.xmlSet = function (urlstr) {
	this.xmlUrl=urlstr;
}

bmProcessor.prototype.xslSet = function (urlstr) {
	this.xslUrl=urlstr;
}

bmProcessor.prototype.setTargetDocument = function (targetDoc) {
	this.targetDocument=targetDoc;
}

bmProcessor.prototype.setTargetElement = function (targetEle) {
	this.targetElement=targetEle;
}

bmProcessor.prototype.apply = function () {

    if(this.xmlRef.getElementsByTagName("li").length<1) {
        this.targetDocument.getElementById("message-empty").style.display="block";
    } else {
        if(this.xmlLoadedState&&this.xslLoadedState) {	
            var xsltProcessor = new XSLTProcessor();
            var htmlFragment=null;
            try {
              xsltProcessor.importStylesheet(this.xslRef);
              htmlFragment = xsltProcessor.transformToFragment(this.xmlRef, this.targetDocument);
            } catch (e) {
            }
            this.targetElement.appendChild(htmlFragment.firstChild);
        }
    }
}

bmProcessor.prototype.run = function () {
	try {
		// Already parsed.
		// this.xmlRef.load(this.xmlUrl);
	} catch (e) {
	}
	try {
		this.xslRef.load(this.xslUrl);
	} catch (e) {
	}

}

