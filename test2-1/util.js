function makePacket({peerId, host, port, connectedPeerTable, connectedPeerTableSize}) {
  //作业要求前三位必须为1
  const version = 0b11100000;

  // 是否是从定向
  let msgType = (connectedPeerTable.length === connectedPeerTableSize ? 0b00000010 : 0b00000001) << 5;

  // msgType在第二个字节中只占3位，后边5位应该接上路由表长度
  msgType = connectedPeerTable.length >> 8 | msgType;

  // 摸出前5位
  const tbSize = (connectedPeerTable.length & 0b0000011111111);
  // peerid的长度
  const idLen = Buffer.from(peerId, 'utf8').length;
  // peerid
  const senderId = Buffer.from(peerId, 'utf8');


  let ipBuffer = Buffer.from([]);
  //遍历路由表
  for (let i = 0; i < connectedPeerTable.length; i++) {
    //申请存放ip的4个字节
    const b6 = Buffer.alloc(4);
    //申请存放port的2个字节
    const b2 = Buffer.alloc(2);

    //取出里面的host跟port
    const [remoteHost, remotePort] = connectedPeerTable[i].split(':');

    remoteHost.split('.').forEach((num, index) => {
      // 每个数字占一个字节
      b6[index] = Number(num);
    });

    // port2个字节就是16位
    b2.writeUInt16BE(Number(remotePort));
    // 合并数据
    ipBuffer = Buffer.concat([ipBuffer, b6]);
    // 合并数据
    ipBuffer = Buffer.concat([ipBuffer, b2]);
  }
  // 合并数据
  const buf1 = Buffer.from([version, msgType, tbSize, idLen]);
  // 合并数据
  const bufA = Buffer.concat([buf1, senderId, ipBuffer]);

  return bufA;
}

function parseMsg (bf) {
  // 取版本号（前三位）
  const version = bf[0] >> 5

  // 抹掉第一个字节的前三位，与上第二个字节的高3位
  const type = ((bf[0] & 0b00011111) << 3) | (bf[1] >> 5);
  // 抹掉前三位，后边补8位，与上第三个字节，提取路由表的长度
  const peerTableLen = ((bf[1] & 0b00011111) << 3 << 8) | bf[2];
  //提取id的长度
  const idLen = bf[3];
  //提取id
  const id = bf.slice(4, 4 + idLen).toString();

  let i = peerTableLen;
  let arr = [];
  // 干掉前四个字节，留下全是id的数据
  let buf = bf.slice(4 + idLen);

  // 把路由表里的ip跟host解析出来
  while (i--) {
    arr.push([`${buf.readUInt8(0)}.${buf.readUInt8(1)}.${buf.readUInt8(2)}.${buf.readUInt8(3)}:${buf.readUInt16BE(4)}`]);
    buf = buf.slice(6);
  }

  //返回
  return { version, type, peerTableLen, idLen, id,  ipPortArr: arr}
}

function makeMUSTPacket(data) {

}

function parseMUSTPacket() {

}

module.exports = {
  makePacket,
  parseMsg,
};
