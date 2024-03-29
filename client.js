
const { connect } = require("http2");
const net = require("net");
const parser = require("./parser.js") //引入自定义parser文件

class Request {
    constructor(options){
        this.method = options.method || "GET";
        this.host = options.host;
        this.port = options.port || "80";
        this.path = options.path || "/";
        this.body = options.body || {};
        this.headers = options.headers || {};

        if(!this.headers["Content-Type"]) {
            this.headers["Content-Type"] = "applicatioin/x-www-from-urlencoded";
        }

        if(this.headers["Content-Type"] === "application/json"){
            this.bodyText = JSON.stringify(this.body);
        } else if (this.headers["Content-Type"] === "applicatioin/x-www-from-urlencoded"){
            this.bodyText = Object.keys(this.body).map(key => `${key}=${encodeURIComponent(this.body[key])}`).join('&');
        }
        
        this.headers["Content-Length"] = this.bodyText.length;
            
    }

    send(connnection){
        return new Promise((resolve,reject) => {
            //......
            const parser = new ResponseParser;
            //建立连接
            if(connnection) {
                connnection.write(this.toString());
            } else {
                connnection = net.createConnection({
                    host : this.host,
                    port : this.port
                }, () => {
                    connnection.write(this.toString());
                })
            }
            connnection.on('data', (data) =>{
                // console.log(data.toString());
                parser.receive(data.toString());
                if(parser.isFinished) {
                    resolve(parser.response);
                    
                }
                connnection.end();
            });
            connnection.on('err',(err) => {
                reject(err);
                connnection.end();
            })
        });
    }

    toString(){
        return `${this.method} ${this.path} HTTP/1.1\r
${Object.keys(this.headers).map(key => `${key}: ${this.headers[key]}`).join('\r\n')}\r
\r
${this.bodyText}`
    }
}

class ResponseParser{
    constructor(){
        this.WATTING_STATUS_LINE = 0;
        this.WATTING_STATUS_LINE_END = 1;
        this.WATTING_HEADER_NAME = 2;
        this.WATTING_HEADER_SPACE = 3;
        this.WATTING_HEADER_VALUE = 4;
        this.WATTING_HEADER_LINE_END = 5;
        this.WATTING_HEADER_BLOCK_END = 6;
        this.WATTING_BODY = 7;

        this.current = this.WATTING_STATUS_LINE;
        this.statusLine = "";
        this.headers = {};
        this.headerName = "";
        this.headerValue = "";
        this.bodyParser = null;

    }
    get isFinished(){
        return this.bodyParser && this.bodyParser.isFinished;
    }

    get response(){
        this.statusLine.match(/HTTP\/1.1 ([0-9]+) ([\s\S]+)/);
        return {
            statusCode: RegExp.$1,
            statusText: RegExp.$2,
            headers: this.headers,
            body: this.bodyParser.content.join('')
        }
    }
    receive(string){
        for(let i = 0; i < string.length; i++) {
            this.receiveChar(string.charAt(i));
        }
    }

    receiveChar(char){
        if(this.current === this.WATTING_STATUS_LINE){
            if(char === '\r'){
                this.current = this.WATTING_STATUS_LINE_END;  
            } else {
                this.statusLine += char;
            }
        } else if(this.current === this.WATTING_STATUS_LINE_END){
            if(char === '\n'){
                this.current = this.WATTING_HEADER_NAME;
            }
        } else if(this.current === this.WATTING_HEADER_NAME){
            if(char === ':'){
                this.current = this.WATTING_HEADER_SPACE;
            } else if( char === '\r'){
                this.current = this.WATTING_HEADER_BLOCK_END;
                if(this.headers['Transfer-Encoding'] === 'chunked'){ //这里简单的针对 chunk类型 node 默认
                    /* 
                    chunk 格式：
                    26 // 16进制
                    <html><body>helloworld<body></html>
                    0
                    */
                    this.bodyParser = new TrunkBodyParser();
                }

            } else {
                this.headerName += char;
            }
        } else if(this.current === this.WATTING_HEADER_SPACE){
            if(char === ' '){
                this.current = this.WATTING_HEADER_VALUE;
            }
        } else if(this.current === this.WATTING_HEADER_VALUE) {
            if(char === '\r'){
                this.current = this.WATTING_HEADER_LINE_END;
                this.headers[this.headerName] = this.headerValue;
                this.headerName = "";
                this.headerValue = "";
            } else {
                this.headerValue += char;
            }
        } else if (this.current === this.WATTING_HEADER_LINE_END){
            if(char === '\n'){
                this.current = this.WATTING_HEADER_NAME;
            }
        } else if (this.current === this.WATTING_HEADER_BLOCK_END){
            if(char === '\n'){
                this.current = this.WATTING_BODY;
            }
        } else if (this.current = this.WATTING_BODY){
            this. bodyParser.receiveChar(char);
        }
    }
}

class TrunkBodyParser {
    constructor() {
        this.WATTING_LENGTH = 0;
        this.WATTING_LENGTH_LINE_END = 1;
        this.READING_TRUNK = 2;
        this.WATTING_NEW_LINE =3;
        this.WATTING_NEW_LINE_END = 4;
        this.length = 0;
        this.content = [];
        this.isFinished = false;
        this.current = this.WATTING_LENGTH;
    }

    receiveChar(char){
        if(this.current === this.WATTING_LENGTH){
            if(char == '\r'){
                if(this.length === 0){
                    this.isFinished = true;
                }
                this.current = this.WATTING_LENGTH_LINE_END;
            } else {
                this.length *= 16;
                this.length += parseInt(char, 16) //解析十六进制
            } 
        } else if (this.current === this.WATTING_LENGTH_LINE_END){
            if(char === '\n'){
                this.current = this.READING_TRUNK;
            }
        } else if (this.current === this.READING_TRUNK){
            this.content.push(char);
            this.length--;
            if(this.length === 0){
                this.current = this.WATTING_NEW_LINE;
            }
        } else if (this.current === this.WATTING_NEW_LINE){
            if(char === '\r'){
                this.current = this.WATTING_NEW_LINE_END;
            }
        } else if (this.current === this.WATTING_NEW_LINE_END){
            if(char ==='\n'){
                this.current = this.WATTING_LENGTH
            }
        }
    }
}

void async function (){
    let request = new Request({
        method: "POST",
        host: "127.0.0.1",
        port: "8080",
        path: "/",
        headers: {
            ["X-Foo2"]: "customed"
        },
        body: {
            name: "azhu"
        }
    });

    let response = await request.send();

    //实际接收resoponse 是需要异步分段接收

    let dom = parser.parserHTML(response.body);
    // console.log(response)
    console.log(dom);
}()

//async function 之后需要加一个（） 不然会导致只是声明了函数但并不会运行
