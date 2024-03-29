const { match } = require('assert');
const css = require('css');

const EOF = Symbol("EOF") ;

let currentToken = null; //将tag当作token处理
let currentAttribute = null;

let stack = [{type:"document",children:[]}];//通过栈 将token转换 建立dom树 
let currentTextNode = null;

let rules = [];

//调用css parser 的css rules
function addCSSRules(text) {
    var ast  = css.parse(text);
    // console.log(JSON.stringify(ast,null, "  "));
    rules.push(...ast.stylesheet.rules);
}

function match(element, selector)


function computeCSS(element) {
    // console.log(rules);
    console.log("compute CSS for element",element);
    var elements = stack.slice().reverse(); //复制防止栈数据被污染  获取元素父级
    if(!element.computedStyle){
        element.computedStyle = {}; //计算的css属性放入选择元素

        for (let rule of rules){
            var selectorParts = rule.selectors[0].split(" ").reverse(); //从内而外搜索

            if(!match(element, selectors[0])){
                continue;
            }
            let matched = false;

            var j = 1;
            for(var i = 0;i < elements.length; i++){
                if(match(elements[i],selectors[j])){
                    j++;
                }
            }
            if(j >= selectorParts.length){
                matched = true;
            }
            if(matched){
                console.log("Element",element,"matched rule ",rule);
            }
        }
    }
}

//将标签转换为token 输出 
function emit(token){
    //if(token.type != "text")
    // console.log(token);
    
    let top = stack[stack.length-1];//栈顶

    if(token.type == "startTag"){
        let element = {
            type: "element",
            children: [],
            attributes: []
        };

        element.tagName = token.tagName;

        for (let p in token){  //将属性添加到element
            if(p != "type" && p != "tagName"){
                element.attributes.push({
                    name:p,
                    value:token[p]
                })
            }
        }

        computeCSS(element); //计算css 规则

        top.children.push(element); //组件入栈
        element.parent = top;

        if(!token.isSelfClose){
            stack.push(element);
        }

        currentTextNode = null;
    } else if (token.type == "endTag"){
        if(top.tagName != token.tagName){
            throw new Error("tag start end doesn't match");
        } else {

            //遇到style标签，执行添加css操作----------------------------
            if(top.tagName == "style"){
                addCSSRules(top.children[0].content)
            }
            stack.pop();
        }
        currentTextNode = null;

    } else if (token.type == "text"){
        if(currentTextNode == null){
            currentTextNode= {
                type:"text",
                content:""
            }
            top.children.push(currentTextNode);
        }
        currentTextNode.content += token.content;
    }

}




function data(c){
    if(c == "<") {
        return tagOpen //标签开始
    } else if (c == EOF) {
        emit({
            type:"EOF",
        })
        return; //所有标签结束 return
    } else {
        emit({
            type:"text",
            content:c //c 文本节点字符
        })
        return data; 
    }
}

//标签分类为 起始标签 结束标签 和自封闭标签
function tagOpen(c){
    if(c == "/"){
        return endTagOpen; //结束标签开始
    } else if (c.match(/^[a-zA-Z]$/)) {
        //开始标签或者是自封闭标签
        currentToken = {
            type: "startTag",
            tagName: ""
        }
        return tagName(c)
    } else {
        return ;
    }
}

function endTagOpen(c){
    if(c.match(/^[a-zA-Z]$/)){
        currentToken = {
            type: "endTag",
            tagName: ""
        }
        return tagName(c);
    } else if (c == ">"){
        
    } else {

    }
}

function tagName(c){
    if(c.match(/^[\t\n\f ]$/)){
        return beforeAttributeName; //开始匹配 标签属性
    } else if (c == "/" ){
        return selfClosingStartTag; //自封闭
    } else if (c.match(/^[a-zA-Z]$/)){
        currentToken.tagName += c; 
        return tagName;
    } else if (c == ">"){
        emit(currentToken)
        return data; //回到data状态 开始解析下一个标签
    } else {
        return tagName; 
    }
}

function beforeAttributeName(c){
    if(c.match(/^[\t\n\f ]$/)) {
        return beforeAttributeName;
    } else if (c == ">" || c == "/" || c == EOF) {
        return afterAttributeName(c);  //这里 没用到？
    } else if (c == "=") {
        return beforeAttributeName;
    } else {
        currentAttribute = {
            name: "",
            value: ""
        }
        return attributeName(c);
    }
}

function attributeName(c){
    if(c.match(/^[\t\n\f ]$/ || c == "/" || c == ">" || c == EOF)){
        return afterAttributeName(c);
    } else if (c == "=") {
        return beforeAttributeValue;
    } else if (c == "\u0000"){

    } else if (c == "\"" || c == "'" || c == "<"){

    } else {
        currentAttribute.name +=c;
        return attributeName;
    }
}

function beforeAttributeValue(c){
    if(c.match(/^[\t\n\f ]$/ || c == "/" || c == ">" || c == EOF)){
        return beforeAttributeValue;
    } else if (c == "\'"){
        return singleQuotedAttributeValue;
    } else if (c == "\""){
        return doubleQuotedAttributeValue;
    } else if(c == ">"){
        //return data;
    } else {
        return UnquotedAttributeValue(c);
    } 
}

function doubleQuotedAttributeValue(c){
    if(c == "\""){
        currentToken[currentAttribute.name] = currentAttribute.value;
        return afterQuotedAttributeValue;
    } else if (c == "\u0000") {

    } else if (c == EOF){

    } else {
        currentAttribute.value += c;
        return doubleQuotedAttributeValue;
    }
}

function singleQuotedAttributeValue(c){
    if(c == "\'"){
        currentToken[currentAttribute.name] = currentAttribute.value;
        return afterQuotedAttributeValue;
    } else if (c == "\u0000"){

    } else if (c == EOF){

    } else {
        currentAttribute.value += c;
        return singleQuotedAttributeValue;
    }
}

function afterQuotedAttributeValue(c){
    if(c.match(/^[\t\n\f ]$/)) {
        return beforeAttributeName;
    } else if (c == "/"){
        return selfClosingStartTag;
    } else if (c ==">"){
        currentToken[currentAttribute.name] = currentAttribute.value;
        emit(currentToken);
        return data;
    } else if (c == EOF){

    } else {
        currentAttribute.value += c;
        return doubleQuotedAttributeValue;
    }
}

function UnquotedAttributeValue(c){
    if(c.match(/^[\t\n\f ]$/)){
        currentToken[currentAttribute.name] = currentAttribute.value;
        return beforeAttributeName;
    } else if (c =="/") {
        currentToken[currentAttribute.name] = currentAttribute.value;
        return selfClosingStartTag;
    } else if (c == ">"){
        currentToken[currentAttribute.name] = currentAttribute.value;
        emit(currentToken);
        return data;
    } else if (c == "\u0000"){

    } else if (c == EOF){

    } else if (c == "\"" || c == "\'" || c == "<" || c == "=" || c == "`"){

    } else {
        currentAttribute.value += c;
        return UnquotedAttributeValue;
    }
}

function selfClosingStartTag(c){
    if(c == ">"){
        currentToken.isSelfClose = true;
        emit(currentToken)
        return data;
    } else if ( c == EOF){
        
    } else {
        
    }
}

function afterAttributeName(c){
    if(c.match(/^[\t\n\f ]$/)){
        return afterAttributeName;
    } else if (c == "/"){
        return selfClosingStartTag;
    } else if (c =="=") {
        return beforeAttributeValue;
    } else if (c == ">"){
        currentToken[currentAttribute.name] = currentAttribute.value;
        emit(currentToken);
        return data;
    } else if ( c == EOF){
        
    } else {
        currentToken[currentAttribute.name] = currentAttribute.value;
        currentAttribute = {
            name: "",
            value: ""
        };
        return attributeName(c);
    }
}

module.exports.parserHTML = function parserHTML(html){
    console.log(html);
    let state = data;
    for(let c of html){
        state = state(c);
    }
    state = state(EOF);
    console.log(stack[0]);
}