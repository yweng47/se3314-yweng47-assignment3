// Some code need to be added here, that are common for the module

module.exports = {
    init: function() {
        // init function needs to be implemented here //
        const t = (Math.random() * 999 + 1) | 0;
        const sequenceNumber = (Math.random() * (1 << 15)) | 0;
        setInterval(() => {
            t += 1;
        }, 10);

    },

    //--------------------------
    //getSequenceNumber: return the current sequence number + 1
    //--------------------------
    getSequenceNumber: function() {
        // Enter your code here //
        sequenceNumber += 1;
        return sequenceNumber % (1 << 15);
    },

    //--------------------------
    //getTimestamp: return the current timer value
    //--------------------------
    getTimestamp: function() {
        return t;
    }
};