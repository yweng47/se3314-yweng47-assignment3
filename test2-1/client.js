const net = require('net');
const {parseMsg} = require('./util');
let must = require('./SRP');
let fs = require("fs");
let ITPResponse = require('./ITPResponse');
let singleton = require('./Singleton');

function startConnect(serverConfig, targetConfig, originIpPortArr = [], i = 0) {
    // 当之前连接的服务端路由表满了，尝试其路由表里其他server的时候，如果到了最后一个都没连上，就退出
    if (originIpPortArr.length === i && i !== 0) {
        console.log(`connection terminates`);
        return;
    }
    // 解构一下，作为服务端，自己的ip跟port，还有id
    const {peerId, host, port, connectedPeerTable, connectedPeerTableSize, peerSocketObject} = serverConfig;
    // 作为客户端需要去尝试连接的服务端的信息
    const [targetHost, targetPort] = targetConfig;

    //创建sock，
    const client = new net.Socket();
    //请求连接
    client.connect(targetPort, targetHost);
    client.write("connect");

    let searchIDList = [];
    let arrivedSearchID = [];

    //客户端收到消息的时候调用
    client.on('data', (data) => {

        let type = parseInt(data[1] >> 5);
        if (type != 3) {
            // 解析收到的数据
            const {version, type, id, ipPortArr} = parseMsg(data);
            // 如果前三位是111,才处理改数据
            if (version === 7) {
                //如果对方路由表没满,打印作业要求的输出
                if (type === 1) {
                    console.log(`Connected to peer ${id}:${targetPort} at timestamp: ${Date.now()}`);
                    console.log(`This peer address is ${host}:${port} located at ${peerId}`);
                    console.log(`Received ack from ${id}:${targetPort}`);
                    // 如果对方的路由表是空的,就不打印下面这句话
                    if (ipPortArr.length !== 0) {
                        console.log(`  which is peered with: ${ipPortArr}`);
                    }
                    connectedPeerTable.push(`${targetHost}:${targetPort}`);
                    //告诉对方自己作为服务端的ip跟port
                    client.write(`${host}:${port}`);
                } else if (type === 2) {
                    //对方路由表满了,打印pdf要求的输出
                    client.write(`${host}:${port}`);
                    console.log(`Received ack from ${id}:${targetPort}`);
                    console.log(`which is peered with: ${ipPortArr}`);
                    console.log(`The join has been declined; the auto-join process is performing ...`);
                    client.end();
                    i++;
                    // originIpPortArr长度为空说明这是第一次连接,否则就是重定向的连接
                    if (originIpPortArr.length === 0) {
                        // 尝试重新连接对方路由表里的其他server
                        startConnect(serverConfig, ipPortArr[i][0].split(':'), ipPortArr, i);
                    } else {
                        startConnect(serverConfig, originIpPortArr[i][0].split(':'), originIpPortArr, i);
                    }
                }
            }
        } else {
            // 搜索历史表的长度
            let n = connectedPeerTable.length;

            // 这个网络数据包是search request packet format，解析数据包
            const {version, message_type, IC, searchID, sender_ID_length, sender_ID, originating_peer_IP, originating_peer_port, images} = must.parseMUST(data);

            // 对等方检查它以前是否看到过相同的查询
            let flag = 0;
            for (let i = 0; i < searchIDList.length; i++) {
                if (searchIDList[i] === searchID) {//看到过该搜索包
                    flag = 1;
                }
            }
            if (flag === 1) {//看到过该搜索包之后执行
                // 丢弃该搜索包
                return;
            } else {//没有看到过该搜索包执行本地查找资源
                // 只需保留最近搜索的最后n个数（以循环方式），其中n=对等表大小。
                if (searchIDList.length < n) {
                    searchIDList.push(searchID);
                    // arrivedSearchID.push(searchID);
                } else {
                    searchIDList.shift();
                    searchIDList.push(searchID);
                    // arrivedSearchID.push(searchID);
                }

                if (!(images.some(image => fs.existsSync("images/" + image)))) {
                    // 查询的所有资源都没有，通过对等网络发送搜索包
                    if (connectedPeerTable.length === 0) {//对等机没有其他对等机转发搜索包且无本地资源
                        // 删除查询
                        return;
                    } else {//广播查询数据包
                        for (let i = 0; i < connectedPeerTable.length; i++) {
                            peerSocketObject[i].write(must.makeMUST(images, 3, searchID, originating_peer_IP, originating_peer_port));
                        }
                    }
                } else {//本地至少有一个拥有的资源
                    let res = [];
                    images.forEach(image => {
                        //对于每个请求的图像，如果本地有，则创建一个新的套接字，并在搜索包中列出的地址和端口号处连接到查询发起对等端。创建该连接只是为了传输图像。一旦图像传输完成，发起传输的对等方将关闭连接。
                        if (fs.existsSync("images/" + image)) {//资源存在
                            // 读取本地图像资源到内存
                            let content = fs.readFileSync("images/" + image);
                            // 获取图像名字
                            let name = image.substring(0, image.lastIndexOf('.'));
                            // 获取图像扩展名
                            let type = image.substring(image.lastIndexOf('.') + 1, image.length);
                            res.push({type, name, content});
                            // 从搜索包中删除图像数据（存在安全隐患）
                            // images.splice(images.indexOf(image), 1);
                        }
                    });
                    let complete = 0;
                    if (images.length === res.length) {
                        // 搜索包中所有数据在本地都有，搜索结束
                        complete = 1;
                        // 构造ITP响应数据包，并新建套接字传输数据，传输完毕关闭套接字
                        // 创建sock，
                        const transmission = new net.Socket();
                        transmission.connect(originating_peer_port, originating_peer_IP);
                        transmission.write(ITPResponse.getPacket(res, 1, complete, 0, Date.now()));
                        transmission.end();
                    } else {
                        // 封装 search request packet
                        // 发送给所有的对等节点
                        for (let i = 0; i < connectedPeerTable.length; i++) {
                            peerSocketObject[i].write(must.makeMUST(images, 3, searchID, originating_peer_IP, originating_peer_port));
                        }
                    }
                }
            }
        }

    });
    //服务端调用end方法的时候调用
    client.on('end', () => {
        console.log('end');
    });
    //服务端发生错误的时候调用
    client.on('error', () => {
        console.log('error');
    });
}


module.exports = {
    startConnect,
};
