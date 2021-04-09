const net = require('net');
const path = require('path');
let fs = require("fs");
const {startConnect} = require('./client');
const {makePacket} = require('./util');
let ITPpacket = require('./ITPResponse');
let singleton = require('./Singleton');
let must = require('./SRP');
// minimist 可以把命令行传进来的参数转成对象
// process.argv.slice(2)干掉前两个无用参数
let {p} = require('minimist')(process.argv.slice(2));

//解析当前的目录，取最后的一个文件夹名字，用-分割，获取peerid跟peer table的大小
let [peerId, connectedPeerTableSize] = path.parse(__dirname).name.split('-');
//字符串转整数
connectedPeerTableSize = Number(connectedPeerTableSize);
const connectedPeerTable = [];
const searchIDList = [];
let res = [];
// 查询标识
// let not_all = 0;
var peerSocketObject = [];
let datas = [];
let all_images = [];

//获取一个随机的端口
function getRandomHostAndPort() {
    return `127.0.0.1:${Math.floor(Math.random() * 64535 + 1000)}`;
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

function startServer() {
    // 取到作为服务端的host跟port
    const [host, port] = getRandomHostAndPort().split(':');
    // 取到服务端image query traffic的host和port
    const [image_host, image_port] = getRandomHostAndPort().split(':');
    // 固定写法创建tcp server
    const server = net.createServer();
    // 创建image socket
    const image_socket = net.createServer();
    let start_time = Date.now();
    let end_time = Date.now();
    // p = "127.0.0.1:28273";
    // 监听host上的port，等待对等节点加入或者自己成为一个服务器。
    server.listen(port, host, () => {
        // 如果p有值，说明此时有一个对等节点要加入P2P网络，走连接的逻辑，没有值就打印作为服务端，服务已经启动好了
        if (p) {
            startConnect({
                peerId,
                host,
                port,
                connectedPeerTable,
                connectedPeerTableSize,
                peerSocketObject
            }, p.split(':'));
        } else {
            console.log(`This peer address is ${host}:${port} located at ${peerId}`);
        }
    });

    // 监听有没有client来连接我这台服务器
    server.on('connection', (sock) => {
        // 接受客户端发来的数据（如果有）
        sock.on('data', (data) => {
            let pattIp = /(2(5[0-5]{1}|[0-4]\d{1})|[0-1]?\d{1,2})(\.(2(5[0-5]{1}|[0-4]\d{1})|[0-1]?\d{1,2})){3}/g;
            if (data.toString() === "connect") {//有节点要加入P2P网络
                // 根据pdf协议封装数据包
                const buf = makePacket({peerId, host, port, connectedPeerTable, connectedPeerTableSize});
                // 发送给客户端
                sock.write(buf);
            } else if (data.toString().search(pattIp) === 0) {//是否允许新节点加入P2P网络
                //路由表没满
                if (connectedPeerTable.length < connectedPeerTableSize) {
                    // 存一下当前有哪些client连到我这里了
                    connectedPeerTable.push(data.toString());
                    // 对等节点主动记录与自己相连的对等节点的socket
                    peerSocketObject.push(sock);
                    console.log('\n');
                    console.log(`Connected from peer ${data.toString()}`);
                } else {
                    //路由表满了
                    console.log('\n');
                    console.log(`Peer table full: ${data.toString()} redirected`);
                }
            } else {//搜索数据包
                let type = parseInt(data[1] >> 5);
                if (type === 3) { // 请求图像查询
                    let searchID = 0;
                    let {
                        version,
                        message_type,
                        IC,
                        searchID11,
                        sender_ID_length,
                        sender_ID,
                        originating_peer_IP,
                        originating_peer_port,
                        images
                    } = must.parseMUST(data);
                    for (let i = 0; i < connectedPeerTable.length; i++) {
                        searchIDList.push(searchID);
                        peerSocketObject[i].write(must.makeMUST(images, 3, searchID, image_host, image_port));
                        searchID++;
                        // peerSocketObject[i].end();
                    }
                }
            }
        });

        // 当客户端调用end的时候会调用
        sock.on('end', () => {
            console.log('end');
        });

        // 当发生错误的时候会调用
        sock.on('error', () => {
            console.log('error');
        });
    });

    // image socket在特定端口和host上监听
    image_socket.listen(image_port, image_host);
    end_time = Date.now();
    console.log(`ImageDB server is started at timestamp: ${end_time - start_time} and is listening on ${image_host}:${image_port}`);
    let imagesocket;
    image_socket.on('connection', (sock) => {
        // 获取当前时间
        end_time = Date.now();
        let timestamp = end_time - start_time;
        console.log(`Client-${image_port} is connected at timestamp: ${timestamp}`);
        // let images = [];

        // 客户端把需要查询的图像相关数据发送给服务器端时调用
        sock.on('data', data => {
            if (parseInt(data[1] >> 4) === 0) {//数据包是客户端查询数据包
                imagesocket = sock;
                console.log("ITP request packet received:");
                let images = [];
                let extensions = [];
                let names = [];
                let line = "";
                let header = data.slice(0, 4);
                res = [];
                all_images = [];
                for (let i = 0; i < data.length; i++) {
                    let byte = "";
                    for (let j = 7; j >= 0; j--) {
                        byte += (data[i] >> j) & 1;
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
                if ((header[0] >> 5) != 7 || header[3] != 0) {
                    // sock.end();
                    return;
                }

                // 解析ITP请求中的图像数据
                for (let i = 0, n = 4; i < (header[0] & 0x1f); i++) {
                    extensions.push(getFileType(parseInt(data[n] / Math.pow(2, 4))).toUpperCase());
                    let len = ((data[n] & 0xf) * Math.pow(2, 8)) | data[n + 1];
                    let imageName = data.slice(n + 2, n + 2 + len).toString();
                    names.push(imageName);
                    images.push(imageName + '.' + getFileType(parseInt(data[n] / Math.pow(2, 4))));
                    all_images.push(imageName + '.' + getFileType(parseInt(data[n] / Math.pow(2, 4))));
                    n += 2 + len;
                }

                console.log("Client-" + timestamp + " requests");
                console.log("    --ITP version: " + (header[0] >> 5));
                console.log("    --Image Count: " + (header[0] & 0x1f));
                console.log("    --Request type: " + "Query");
                console.log("    --Image file extension(s): " + extensions.join(","));
                console.log("    --Image file name(s): " + names.join(","));
                console.log();


                // 在P2P网络中搜索资源
                if (!(images.some(imagename => fs.existsSync("images/" + imagename)))) {
                    // 查询的所有资源都没有，通过peer socket对等网络发送搜索包
                    // 封装搜索包并广播给对等节点表中的所有节点
                    // not_all = 1;
                    // 通知客户端资源查询失败响应包，要求授权本服务器节点在P2P网络中收集资源
                    let imagesList = [];
                    images.forEach(image => {
                        [name, type] = image.split(".");
                        let content = [0];
                        imagesList.push({type, name, content});
                    });
                    end_time = Date.now();
                    let pkt = ITPpacket.getPacket(imagesList, 0, 0, 0, end_time - start_time);
                    let s = Buffer.from(host + ":" + port);
                    let data = [];
                    data.push(pkt);
                    data.push(s);
                    sock.write(Buffer.concat(data));//未找到的响应数据包
                } else {//本地至少有一个拥有的资源
                    if (images.every(imagename => fs.existsSync("images/" + imagename))) {
                        //所有数据在第一次查询时就全部找到，直接返回响应数据包
                        images.forEach(imagename => {
                            // 读取本地图像资源到内存
                            let content = fs.readFileSync("images/" + imagename);
                            // 获取图像名字
                            let name = imagename.substring(0, imagename.lastIndexOf('.'));
                            // 获取图像扩展名
                            let type = imagename.substring(imagename.lastIndexOf('.') + 1, imagename.length);

                            res.push({type, name, content});
                        });
                        end_time = Date.now();
                        sock.write(ITPpacket.getPacket(res, 1, (images.every(imagename => fs.existsSync("images/" + imagename))) ? 1 : 0, 0, end_time - start_time));
                        sock.end();
                    } else {
                        // 资源不全，需要在P2P网络中进行搜索
                        let imagesList = [];
                        images.forEach(imagename => {
                            if (!fs.existsSync("images/" + imagename)) {//资源不存在
                                // 封装 search request packet
                                // 发送给所有的对等节点
                                [name, type] = imagename.split(".");
                                let content = [0];
                                imagesList.push({type, name, content});
                            } else {//资源存在
                                // 读取本地图像资源到内存
                                let content = fs.readFileSync("images/" + imagename);
                                // 获取图像名字
                                let name = imagename.substring(0, imagename.lastIndexOf('.'));
                                // 获取图像扩展名
                                let type = imagename.substring(imagename.lastIndexOf('.') + 1, imagename.length);

                                res.push({type, name, content});
                            }
                        });
                        end_time = Date.now();
                        let pkt = ITPpacket.getPacket(imagesList, 0, 0, 0, end_time - start_time);
                        let s = Buffer.from(host + ":" + port);
                        let data = [];
                        data.push(pkt);
                        data.push(s);
                        sock.write(Buffer.concat(data));//未找到的响应数据包
                    }
                }
            } else {
                datas.push(data);
            }
        });

        sock.on('end', () => {
            // 返回相应数据包有两种情况：1、P2P网络中有节点返回部分资源;2、P2P网络中有节点返回全部资源
            if (!all_images.every(allimage => fs.existsSync("images/" + allimage))) {
                console.log("ITP response packet received:");
                let data = Buffer.concat(datas);
                const {F, IC, images} = ITPpacket.parseITPResponsePacket(data);
                images.forEach(image => {
                    if (!fs.existsSync("images/" + image.name + "." + image.type)) {
                        fs.writeFileSync("images/" + image.name + "." + image.type, image.content);
                        res.push(image);
                    }
                });

                if (F === 1) {
                    end_time = Date.now();
                    imagesocket.write(ITPpacket.getPacket(res, 1, 1, 0, end_time - start_time));
                    imagesocket.end();
                }
            }
        });

        sock.on('close', () => {
            end_time = Date.now();
            console.log("Client-" + end_time - start_time + " closed the connection\n");
        });
    });


}

startServer();
