module.exports = {
    init: function () {
        // feel free to add function parameters as needed
        //
        // enter your code here
        //
    },

    makeMUST: function (images, messagetype, SearchID, image_host, image_port, Sender_ID_length = 0, Sender_ID = 0) {
        let pkt = [];
        pkt.push(parseInt(7 << 5 | messagetype >> 3));
        pkt.push((parseInt(messagetype * Math.pow(2, 5)) | parseInt(images.length) & 255));
        pkt.push(SearchID & 255);
        pkt.push(Sender_ID_length & 255);
        pkt.push(parseInt(Sender_ID / Math.pow(2, 24)));
        pkt.push((parseInt(Sender_ID / Math.pow(2, 16))) & 255);
        pkt.push((parseInt(Sender_ID / Math.pow(2, 8))) & 255);
        pkt.push(Sender_ID & 255);

        image_host.split('.').forEach(num => {
            // 每个数字占一个字节
            pkt.push(Number(num) & 255)
        });

        pkt.push(parseInt(image_port >> 8) & 255);
        pkt.push(parseInt(image_port & 255));

        // 解析图像名称列表
        images = images.map(imageName => {
            const [name, type] = imageName.split(".");
            return { type, name };
        });

        images.forEach(image => {
            pkt.push(parseInt(getFileType(image.type) * Math.pow(2, 4)) | parseInt(image.name.length / Math.pow(2, 8)));
            pkt.push(image.name.length & 255);
            for (let i = 0; i < image.name.length; i++) {
                pkt.push(image.name.charCodeAt(i));
            }
        });
        return Buffer.from(pkt);
    },

    parseMUST: function (data) {
        let version = data[0] >> 5;
        let message_type = data[1] >> 5;
        let IC = parseInt(data[1] & 0x1f);
        let searchID = parseInt(data[2]);
        let sender_ID_length = parseInt(data[3]);
        let sender_ID = 0;
        let originating_peer_IP = parseInt(data[8]) + '.' + parseInt(data[9]) + '.' + parseInt(data[10]) + '.' + data[11];
        let originating_peer_port = parseInt(data[12] << 8 | data[13]);
        let images = [];
        let len = 0;
        let j = 0;
        let image_name = "";
        for(let i = 0; i < IC; i++){
            // 获取File name size
            j = parseInt(data[14 + len] << 8 & 255 | data[15 + len]);
            for(let k=0;k<j;k++){
                image_name += String.fromCharCode(data[16 + len + k]);
            }
            images.push(image_name + '.' + getFileType1(parseInt(data[14 + len] >> 4)));
            len = len + 2 + j;
            image_name = "";
        }
        return { version, message_type, IC, searchID, sender_ID_length, sender_ID, originating_peer_IP, originating_peer_port, images};
    },
};

// Extra utility methods can be added here
function getFileType(type) {
    if (type == "bmp") {
        return 1;
    } else if (type == "jpeg") {
        return 2;
    } else if (type == "gif") {
        return 3;
    } else if (type == "png") {
        return 4;
    } else if (type == "tiff") {
        return 5;
    } else if (type == "raw") {
        return 15;
    } else {
        return 0;
    }
}

function getFileType1(type) {
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