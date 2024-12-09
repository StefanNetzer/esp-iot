//% color=#0fbc11 icon="\uf1eb"
namespace ESP8266_IoT {
    enum Cmd {
        None,
        ConnectWifi,
        ConnectThingSpeak,
        ConnectSmartIot,
        InitSmartIot,
        UploadSmartIot,
        DisconnectSmartIot,
        ConnectMqtt,
    }

    export enum SmartIotSwitchState {
        //% block="on"
        on = 1,
        //% block="off"
        off = 2
    }

    export enum SchemeList {
        //% block="TCP"
        TCP = 1,
        //% block="TLS"
        TLS = 2
    }

    export enum QosList {
        //% block="0"
        Qos0 = 0,
        //% block="1"
        Qos1,
        //% block="2"
        Qos2
    }

    let wifi_connected: boolean = false
    let thingspeak_connected: boolean = false
    let smartiot_connected: boolean = false
    let mqttBrokerConnected: boolean = false
    let userToken_def: string = ""
    let topic_def: string = ""
    const mqttSubscribeHandlers: { [topic: string]: (message: string) => void } = {}
    const mqttSubscribeQos: { [topic: string]: number } = {}
    let mqtthost_def = "ELECFREAKS"
    let iftttkey_def = ""
    let iftttevent_def = ""
    let thingSpeakDatatemp = ""

    let serialCnt = 0
    let recvString = ""
    let scanWIFIAPFlag = 0
    let currentCmd: Cmd = Cmd.None

    const THINGSPEAK_HOST = "api.thingspeak.com"
    const THINGSPEAK_PORT = "80"
    const SMARTIOT_HOST = "47.239.108.37"
    const SMARTIOT_PORT = "8081"
    // export function change(a:any,b:any){
    //     SMARTIOT_HOST = a
    //     SMARTIOT_PORT = b
    // }

    const EspEventSource = 3000
    const EspEventValue = {
        None: Cmd.None,
        ConnectWifi: Cmd.ConnectWifi,
        ConnectThingSpeak: Cmd.ConnectThingSpeak,
        ConnectSmartIot: Cmd.ConnectSmartIot,
        InitSmartIot: Cmd.InitSmartIot,
        UploadSmartIot: Cmd.UploadSmartIot,
        DisconnectSmartIot: Cmd.DisconnectSmartIot,
        ConnectMqtt: Cmd.ConnectMqtt,
        PostIFTTT: 255
    }
    const SmartIotEventSource = 3100
    const SmartIotEventValue = {
        switchOn: SmartIotSwitchState.on,
        switchOff: SmartIotSwitchState.off
    }

    let TStoSendStr = ""

    // write AT command with CR+LF ending
    function sendAT(command: string, wait: number = 0) {
        serial.writeString(`${command}\u000D\u000A`)
        basic.pause(wait)
    }

    function restEsp8266() {
        sendAT("AT+RESTORE", 1000) // restore to factory settings
        sendAT("AT+RST", 1000) // rest
        serial.readString()
        sendAT("AT+CWMODE=1", 500) // set to STA mode
        sendAT("AT+SYSTIMESTAMP=1634953609130", 100) // Set local timestamp.
        sendAT(`AT+CIPSNTPCFG=1,8,"ntp1.aliyun.com","0.pool.ntp.org","time.google.com"`, 100)
        basic.pause(3000)
    }

    function scanWIFIAP(ssid: string) {

        let scanflag = 0
        let mscnt = 0
        recvString = " "
        sendAT(`AT+CWLAPOPT=1,2,-100,255`)
        sendAT(`AT+CWLAP`)
        while (!(scanflag)) {

            recvString = recvString + serial.readString()
            basic.pause(1)
            mscnt += 1
            if (mscnt >= 3000) {
                scanWIFIAPFlag = 0
                break
            }

            if (recvString.includes("+CWLAP:(")) {

                mscnt = 0
                recvString = recvString.slice(recvString.indexOf("+CWLAP:("))
                scanflag = 1
                while (1) {

                    recvString += serial.readString()
                    basic.pause(1)
                    mscnt += 1

                    // OLED.clear()
                    // OLED.writeStringNewLine(_recvString)
                    if (recvString.includes("OK") || mscnt >= 3000) {

                        if (mscnt >= 3000) {
                            scanWIFIAPFlag = 0
                        } else if (recvString.includes(ssid)) {
                            scanWIFIAPFlag = 1
                        } else {
                            scanWIFIAPFlag = 0
                        }
                        break
                    }
                }
            }

        }
        recvString = " "
    }

    /**
     * Initialize ESP8266 module
     */
    //% block="set ESP8266|RX %tx|TX %rx|Baud rate %baudrate"
    //% tx.defl=SerialPin.P8
    //% rx.defl=SerialPin.P12
    //% ssid.defl=your_ssid
    //% pw.defl=your_password weight=100
    export function initWIFI(tx: SerialPin, rx: SerialPin, baudrate: BaudRate) {
        serial.redirect(tx, rx, BaudRate.BaudRate115200)
        basic.pause(100)
        serial.setTxBufferSize(128)
        serial.setRxBufferSize(128)
        restEsp8266()
    }

    /**
     * connect to Wifi router
     */
    //% block="connect Wifi SSID = %ssid|KEY = %pw"
    //% ssid.defl=your_ssid
    //% pw.defl=your_pwd weight=95
    export function connectWifi(ssid: string, pw: string) {

        while (1) {
            scanWIFIAP(ssid)
            if (scanWIFIAPFlag) {
                currentCmd = Cmd.ConnectWifi
                sendAT(`AT+CWJAP="${ssid}","${pw}"`) // connect to Wifi router
                control.waitForEvent(EspEventSource, EspEventValue.ConnectWifi)
                while (!wifi_connected) {
                    restEsp8266()
                    sendAT(`AT+CWJAP="${ssid}","${pw}"`)
                    control.waitForEvent(EspEventSource, EspEventValue.ConnectWifi)
                }
                break
            } else {
                restEsp8266()
                currentCmd = Cmd.ConnectWifi
                sendAT(`AT+CWJAP="${ssid}","${pw}"`)
                control.waitForEvent(EspEventSource, EspEventValue.ConnectWifi)
                if (wifi_connected) {
                    break
                }
            }
        }
    }
