// You may need to add some delectation here

module.exports = {

    init: function() { // feel free to add function parameters as needed

    },

    getPacket: function(images, responseType, findAll, sequenceNumber, timestamp) {
        let pkt = [];

        pkt.push(parseInt(7 * Math.pow(2, 5)) | parseInt(findAll * Math.pow(2, 4)) | parseInt(responseType / Math.pow(2, 4)));
        pkt.push((parseInt(responseType * Math.pow(2, 4)) | parseInt(images.length / 2) & 255));
        pkt.push((parseInt(images.length * Math.pow(2, 7)) | parseInt(sequenceNumber / Math.pow(2, 8))) & 255);
        pkt.push(sequenceNumber & 255);
        pkt.push(parseInt(timestamp / Math.pow(2, 24)));
        pkt.push((parseInt(timestamp / Math.pow(2, 16))) & 255);
        pkt.push((parseInt(timestamp / Math.pow(2, 8))) & 255);
        pkt.push(timestamp & 255);

        let len = 0;
        images.forEach(image => {
            pkt.push(parseInt(getFileType(image.type) * Math.pow(2, 4)) | parseInt(image.name.length / Math.pow(2, 8)));
            pkt.push(image.name.length & 255);
            pkt.push((image.content.length >> 8) & 255);
            pkt.push((image.content.length & 255));

            // 封装图像名字
            let names = image.name;
            for (let j = 0; j < names.length; j++) {
                pkt.push(names.charCodeAt(j));
            }

            // 封装图像数据
            for(let i=0;i<image.content.length;i++){
                pkt.push(image.content[i]);
            }

        });

        return Buffer.from(pkt);
    },

    parseITPResponsePacket: function(data){
        let len=0;
        let F = parseInt(data[0] >> 4 & 0x01);
        let IC = parseInt((data[1] << 1 | data[2] >> 7) & 0x1f);
        let responseType = ((data[0] << 4) & 255) | (data[1] >> 4)
        let images = [];
        for(let i=0;i<IC;i++){
            let type = getFileType1(parseInt(data[8 + len] >> 4));
            let j = parseInt((data[8 + len] << 8) & 255 | data[9 + len]);
            let name = "";
            for(let k=0;k<j;k++){
                name += String.fromCharCode(data[12 + len + k]);
            }
            let image_size =  parseInt((data[10 + len] << 8) | data[11 + len]);
            let content = [];
            for(let z=0;z<image_size;z++){
                content.push(data[12 + j + len + z]);
            }
            len = len + 4 + image_size + j;
            images.push({type, name, content});
        }
        return {F, IC, images, responseType};
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