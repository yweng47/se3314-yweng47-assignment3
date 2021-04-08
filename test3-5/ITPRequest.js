// You may need to add some delectation here

module.exports = {
    init: function() {
        // feel free to add function parameters as needed
        //
        // enter your code here
        //
    },

    //--------------------------
    //getBytePacket: returns the entire packet in bytes
    //--------------------------
    getBytePacket: function(version, images) {
        // enter your code here
        let pkt = [];
        pkt.push(version << 5 | images.length);
        for (let i = 0; i < 3; i++) {
            pkt.push(0);
        }
        images.forEach(image => {
            // IT
            pkt.push( parseInt(getFileType(image.type) * Math.pow(2, 4)) | parseInt(images.length / Math.pow(2, 4)));

            // File name size
            pkt.push(image.name.length & 255);

            // image file name
            let names = image.name;
            for (let j = 0; j < names.length; j++) {
                pkt.push(names.charCodeAt(j));
            }
        });
        return Buffer.from(pkt);
    },

    //--------------------------
    //getBitPacket: returns the entire packet in bits format
    //--------------------------
    getBitPacket: function(version, images) {
        // enter your code here
        return "this should be a correct packet";
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