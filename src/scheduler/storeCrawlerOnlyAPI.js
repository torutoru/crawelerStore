import axios from "axios";
import fs from "fs";
import {sendMail} from "../api/sendMail.js";
import {sendMessage} from "../api/doorayWebHook.js";
import Const from "../const.js";

const axiosInstance = axios.create({
    baseURL: 'https://openapi.foodsafetykorea.go.kr/api/73f9a4125fc84bba8c0d/I2861/json'
});
const SEARCH_DATA_MOUNT = 1000;

const DATA_CHANGE_HISTORY_COLUMN_INFO = [
    { key: 'CHNG_DT', name: '변경일자' },
    { key: 'CHNG_BF_CN', name: '변경 전 정보' },
    { key: 'CHNG_AF_CN', name: '변경 후 정보' },
];

const createChangeHistoryTableStr = (changeList) => {
    let tableStr = '<table>';

    // set column
    tableStr += '<tr>';
    DATA_CHANGE_HISTORY_COLUMN_INFO.forEach((info) => {
        tableStr += `<th scope="col" style="width: 33%; height: 50px; text-align: center; border: 1px solid #000;">${info.name}</th>`;
    });
    tableStr += '</tr>';

    // set data
    changeList.forEach((change) => {
        tableStr += '<tr>';
        DATA_CHANGE_HISTORY_COLUMN_INFO.forEach((info) => {
            tableStr += `<td scope="col" style="width: 33%; height: 50px; text-align: center; border: 1px solid #000;">${change[info.key]}</td>`;
        });
        tableStr += '</tr>';
    });

    tableStr += '</table>';
    return tableStr
}
const makeHTMLData = (data) => {
    let lcnsNumberList = Object.keys(data);
    let htmlStr = '<!DOCTYPE html><html lang="ko"><head><title>인허가 변경 정보</title></head><body>';
    if (Array.isArray(lcnsNumberList) && lcnsNumberList.length > 0) {
        htmlStr += `<h1>정보 수집 날짜: ${new Date().toLocaleDateString()}, 수집한 가게수: ${lcnsNumberList.length}</h1>`;
        htmlStr += '<ol>';
        lcnsNumberList.forEach((lcnsNumber) => {
            htmlStr += `<li>
                <h3>인허가번호:${lcnsNumber}, 상호명: ${data[lcnsNumber][0].BSSH_NM} </h3>
                <h4>주소: ${data[lcnsNumber][0].SITE_ADDR}</h4>
                <h4>전화번호: ${data[lcnsNumber][0].TELNO}</h4>
                <h4>인허가 변경 내역</h4>
                ${createChangeHistoryTableStr(data[lcnsNumber])}
            </li>`;
        });
        htmlStr += '</ol>';
    } else {
        htmlStr += '<div>No Data</div>'
    }

    return htmlStr + '</body></html>';
};

const replaceCommaChar = (str) => {
    return str ? str.replace(/,/g, " ") : '';
}

const getNumberString = (numberStr) => {
    return numberStr ? `="${numberStr}"` : ""
}

const makeCSVFile = (date, data) => {
    // make scv string
    let csvString = '인허가 변경일자,인허가 번호,상호명,주소,전화번호,인허가 before 정보,인허가 after 정보\n'; // Header

    let lcnsNumberList = Object.keys(data);
    if (Array.isArray(lcnsNumberList) && lcnsNumberList.length > 0) {
        lcnsNumberList.forEach((lcnsNumber) => {
           if (Array.isArray(data[lcnsNumber]) && data[lcnsNumber].length > 0) {
               data[lcnsNumber].forEach((item) => {
                   csvString += `${getNumberString(item.CHNG_DT)},${getNumberString(item.LCNS_NO)},${replaceCommaChar(item.BSSH_NM)},${replaceCommaChar(item.SITE_ADDR)},${getNumberString(item.TELNO)},${replaceCommaChar(item.CHNG_BF_CN)},${replaceCommaChar(item.CHNG_AF_CN)}\n`;
               });
           }
        });
    }

    const csvFileName = `${date}_file.csv`;
    // make csv file

    try {
        fs.writeFileSync(`${Const.FILE_BASE_PATH}/output/${csvFileName}`, '\uFEFF' + csvString, { encoding: 'utf-8' });
    } catch (e) {
        console.error('[makeCSVFile] failed to save csv file. cause:', e);
        return null;
    }

    return csvFileName;
};
const getStoreInfo = async (searchKeyWordList, compareDate) => {
    let searchIndex = 1; // 1 - base
    let storeChangeMap = {}; // key - LCNS_NO, value - list

    // find
    try {
        let response, findCount;
        let loopCount = 990; // 1000 -> 한계
        for (let i = 0; i < loopCount; i++) {
            // console.log(`[${i}] path: /${searchIndex}/${(i + 1) * SEARCH_DATA_MOUNT}`);
            // debug
            // response = {};
            // response.data = JSON.parse(fs.readFileSync(`${Const.FILE_BASE_PATH}/dummy.json`, 'utf-8'));
            console.log(`[${i + 1}/${loopCount}] API PATH: /${searchIndex}/${((i + 1) * SEARCH_DATA_MOUNT)}`);
            response = await axiosInstance.get(`/${searchIndex}/${((i + 1) * SEARCH_DATA_MOUNT)}`);
            if (response?.data?.I2861) {
                if (response.data.I2861.row) {
                    console.log(`[${i + 1}/${loopCount}] API PATH: /${searchIndex}/${((i + 1) * SEARCH_DATA_MOUNT)}, total_count: ${response.data.I2861.total_count}, row_length: ${response.data.I2861.row.length}`)
                    findCount = 0;
                    response.data.I2861.row.forEach((item) => {
                        // 1. 선호지역
                        if (Array.isArray(searchKeyWordList) && searchKeyWordList.length > 0 && !searchKeyWordList.some((searchKeyword) => item.SITE_ADDR.includes(searchKeyword))) {
                            return;
                        }

                        // 2. 날짜.
                        if (compareDate && item.CHNG_DT < compareDate) {
                            return;
                        }

                        // 3. 인허가 변경 정보 중 대표가 바뀐 케이스만 수집(마스킹처리로 확인)
                        if (!item.CHNG_BF_CN?.includes("**")) {
                            return;
                        }

                        if (!Array.isArray(storeChangeMap[item.LCNS_NO])) {
                            storeChangeMap[item.LCNS_NO] = [];
                        }
                        storeChangeMap[item.LCNS_NO].push(item);
                        findCount++;
                    });
                    console.log(`API PATH: /${searchIndex}/${((i + 1) * SEARCH_DATA_MOUNT)}. FindCount: ${findCount}`);
                } else if (response.data.I2861?.RESULT?.CODE === 'INFO-200') {
                    await sendMessage('[storeCrawlerOnlyAPI] serchIndex 1로 초기화 필요함. 찾기 종료');
                    console.log(`API PATH: /${searchIndex}/${((i + 1) * SEARCH_DATA_MOUNT)}. FINISHED`, response?.data);
                    break;
                } else {
                    await sendMessage('[storeCrawlerOnlyAPI] API 오류발생.');
                    console.log(`API PATH: /${searchIndex}/${((i + 1) * SEARCH_DATA_MOUNT)}. FINISHED`, response?.data);
                }
            } else {
                await sendMessage('[storeCrawlerOnlyAPI] I2861 object 없음. 찾기 종료.');
                console.log(`API PATH: /${searchIndex}/${((i + 1) * SEARCH_DATA_MOUNT)}. FINISHED`, response?.data);
                break;
            }
            searchIndex += SEARCH_DATA_MOUNT;
        }
    } catch (e) {
        console.error('failed to crawler. cause:', e);
    }

    // sorting
    Object.values(storeChangeMap).forEach((list) => {
        list.sort((a, b) => a.CHNG_DT < b.CHNG_DT);
    });

    return { data: storeChangeMap, index: searchIndex };
};

const getSendEmailData = async () => {
  try {
    const sendEMailData = fs.readFileSync(`${Const.FILE_BASE_PATH}/sendEmailData.json`, 'utf-8');
    return JSON.parse(sendEMailData);
  } catch (e) {
      console.error('Failed to get Send Email Data. cause:', e);
  }
  return {};
};

const setSendEmailData = async (info, emailData) => {
    try {
        Object.keys(info.data).forEach((key) => {
            // key - 인허가번호
            emailData[key] = info.data[key][0].CHNG_DT; // 최신 알려준 날짜
        })

        fs.writeFileSync(`${Const.FILE_BASE_PATH}/sendEmailData.json`, JSON.stringify({ index: info.index, data: emailData }));
    } catch (e) {
        console.error('Failed to set Send Email Data. cause:', e);
    }
};

const compareStockData = (storeData, emailData) => {
    // storeData = key: 인허가번호, value: change list
    // emailData = key: 인허가번호, value: date string(YYYYMMDD)
    let removeKeyList = [];
    Object.keys(storeData).forEach((storeLCNS) => {
       if (emailData[storeLCNS] && storeData[storeLCNS][0].CHNG_DT <= emailData[storeLCNS]) {
            removeKeyList.push(storeLCNS);
       }
    });

    removeKeyList.forEach((deleteKey) => {
        delete storeData[deleteKey];
    });
}

const createCompareDateStr = () => {
    const searchDate = new Date();
    searchDate.setDate(searchDate.getDate() - 3); // 오늘로 부터 3일전 날짜
    return searchDate.getFullYear() + ((searchDate.getMonth() + 1).toString().padStart(2, '0')) + searchDate.getDate().toString().padStart(2, '0');
}

const crawlerStoreOnlyAPI = async (compareDateStr) => {

    if (!compareDateStr) {
        compareDateStr = createCompareDateStr(compareDateStr);
    }

    // get before send Email data
    const emailInfo = await getSendEmailData(); // { index: number, data: obj }

    // get new store data
    const info = await getStoreInfo(['경기도'], compareDateStr);

    // compare with new store data & Email Data
    compareStockData(info.data, emailInfo.data);

    // send email
    await sendMail(`경기도 인허가 변경 정보. 인허가변경 검색 기준일자: ${compareDateStr}`, makeHTMLData(info.data));

    // save email data
    await setSendEmailData(info, emailInfo.data);
};

const crawlerStoreUsingFile = async (compareDateStr) => {
    if (!compareDateStr) {
        compareDateStr = createCompareDateStr(compareDateStr);
    }

    // get before send Email data
    const emailInfo = await getSendEmailData(); // { index: number, data: obj }

    const searchRegionList = ['경기도', '서울특별시', '인천광역시'];
    // get new store data
    const info = await getStoreInfo(searchRegionList, compareDateStr);

    // compare with new store data & Email Data
    compareStockData(info.data, emailInfo.data);

    // make csv 파일
    const fileName = makeCSVFile(compareDateStr, info.data);

    if (fileName) {
        // make file success > send mail
        await sendMail(`인허가 변경일 기준: ${compareDateStr} 업체 정보`,
            `<b>검색조건</b><br/>-. 지역: ${searchRegionList.join()}<br/>-. 인허가 변경일 ${compareDateStr} 이후.<br/><br/><b>검색된 가게 수</b>: ${Object.keys(info.data).length}`,
            fileName);

        // set last email data
        await setSendEmailData(info, emailInfo.data);
    } else {
        console.log('Failed to send Mail');
    }
}

export { crawlerStoreOnlyAPI, crawlerStoreUsingFile }