let net = require("net");
let fs = require("fs");
let open = require("open");
let ITPpacket = require("./ITPRequest"); // uncomment this line after you run npm install command
let ITPResponse = require("./ITPResponse");
let must = require("./SRP");

// Enter your code for the client functionality here

let s = ""; //Service address
let q = []; //Picture name
let v = "7"; //Version
let b = []; //Picture data
let p = process.argv; //Get parameters
// let p = "node GetImage -s 127.0.0.1:15999 -q rose.gif parrot.jpeg -v 7".split(" ");
const sock = new net.Socket();

// 解析客户端的查询命令
for (let i = 2; i < p.length; i++) {
    if (p[i] == '-s') {
        s = p[i + 1];
    } else if (p[i] == '-q') {
        while (i < p.length - 1 && p[i + 1].indexOf("-") == -1) {
            q.push(p[i + 1]);
            i++;
        }
    } else if (p[i] == '-v') {
        v = parseInt(p[i + 1]);
    }
}

const [host, port] = s.split(":");

// 发出连接请求127.0.0.1:18337
sock.connect(port, host);

// 解析图像名称列表
let images = q.map(imageName => {
    const [name, type] = imageName.split(".");
    return { type, name };
});

sock.write(ITPpacket.getBytePacket(v, images));

// get a parameter in ITP packet.
function getResponseTypeName(type) {
    if (type == 0) {
        return "Query";
    } else if (type == 1) {
        return "Found";
    } else if (type == 2) {
        return "Not Found";
    } else if (type == 3) {
        return "Busy";
    } else {
        return "";
    }
}

function getFileType(type) {
    if (type == 1) {
        return "bmp";
    } else if (type == 2) {
        return "jpeg";
    } else if (type == 3) {
        return "gif";
    } else if (type == 4) {
        return "png";
    } else if (type == 5) {
        return "tiff";
    } else if (type == 15) {
        return "raw";
    } else {
        return "";
    }
}

sock.on('connect', () => {
    console.log("Connect to ImageDB server on: " + s);
});

sock.on("data", data => {
    let {F, IC, images, responseType} = ITPResponse.parseITPResponsePacket(data);
    if(responseType === 0){
        let sizeL = 8 + IC * 5;
        for(let i=0;i<IC;i++){
            sizeL += images[i].name.length
        }
        let s = data.slice(sizeL, data.length).toString();
        let [peerhost, peerport] = s.split(":");
        let socket = new net.Socket();
        socket.connect(peerport, peerhost);
        let imagesList = [];
        for(let i=0;i<IC;i++){
            imagesList.push(images[i].name + "." + images[i].type);
        }
        socket.write(must.makeMUST(imagesList, 3, 0, "0.0.0.0", 0));
        socket.end();
    }else{
        b.push(data);
    }

});

sock.on("end", () => {
    let data = Buffer.concat(b);
    let header = data.slice(0, 8);
    console.log("ITP packet header received: ");
    let line = "";
    for (let i = 0; i < header.length; i++) {
        let byte = "";
        for (let j = 7; j >= 0; j--) {
            byte += (header[i] >> j) & 1;
        }
        line += byte + " ";
        if (i % 4 == 3) {
            console.log(" " + line);
            line = "";
        }
    }
    if (line != "") {
        console.log(" " + line);
    }

    console.log("Server sent:");
    console.log("    --ITP version = " + (header[0] >> 5));
    console.log("    --Fulfilled = " + (((header[0] >> 4) & 1) ? "YES" : "NO"));
    console.log("    --Response Type = " + getResponseTypeName((((header[0] & 0xf) << 4) | ((header[1] >> 4)))));
    console.log("    --Image Count = " + (((header[1] & 0xf) << 1) | (header[2] >> 7)));
    console.log("    --Sequence Number = " + (((header[2] & 0x7f) << 8) | header[3]));
    console.log("    --Timestamp = " + ((header[4] << 24) | (header[5] << 16) | (header[6] << 8) | (header[7])) + "\n");

    let {F, IC, images, responseType} = ITPResponse.parseITPResponsePacket(data);
    if(responseType === 1){
        for (let i = 0; i < IC; i++) {
            let imageName = images[i].name + "." + images[i].type;
            fs.writeFileSync(imageName, Buffer.from(images[i].content));
            open(imageName);
        }
        sock.end();
        console.log("Disconnected from the server");
    }else{

    }
});

sock.on("close", () => {
    console.log("Connection closed");
});