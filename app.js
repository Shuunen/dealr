const fs = require('fs')
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'))
const puppeteer = require('puppeteer')
const request = require('request')
const hoursBetweenRuns = 1
const temperatureMin = 450
const limit = 3
const dealsSentFile = 'deals-sent.log'
const testMode = false
const verbose = false
const useInterval = false // TODO : this is not the good way and it consume memory
let dealsSent = []

const log = (str) => console.log(time() + ' : ' + str)

const time = (addHours = 0) => {
    const date = new Date()
    date.setHours(date.getHours() + addHours)
    const hours = date.getHours() + ''
    const minutes = date.getMinutes() + ''
    return (hours.length === 1 ? '0' : '') + hours + 'h' + (minutes.length === 1 ? '0' : '') + minutes
}

try {
    dealsSent = fs.readFileSync(dealsSentFile, 'utf8').trim().split('\n')
    log('Found ' + dealsSent.length + ' deals already sent in ' + dealsSentFile)
} catch (e) {
    fs.writeFileSync(dealsSentFile, '', (err) => log(err ? err : 'created empty ' + dealsSentFile))
}

const postDeal = (deal) => {
    if (testMode) return
    const message = (deal.price ? deal.price + ' ' : '') + '@ ' + deal.merchant + ' : ' + deal.url
    const options = { uri: config.iftttWebhook, method: 'POST', json: { value1: message } }
    request(options, (error) => {
        if (error) { log('postDeal error : ' + error) } else if (!testMode) { // all went good and not in test mode
            dealsSent.push(deal.id) // persist to in memory list
            fs.appendFileSync(dealsSentFile, deal.id + '\n') // and on file system
        }
    })
}

const logNextSrap = () => log('Next execution planned in ' + hoursBetweenRuns + ' hours at ' + time(hoursBetweenRuns))

const scroll = (page) => page.evaluate(() => new Promise(resolve => {
    window.scrollTo(0, document.body.scrollHeight)
    setTimeout(() => resolve(), 500)
}))

const scrape = async () => {
    log('Start deals scrapping...')
    const browser = await puppeteer.launch({ headless: true })
    const page = await browser.newPage()

    await page.goto('https://www.dealabs.com')
    await page.waitFor(800)
    await scroll(page)
    await scroll(page)
    await scroll(page)

    let deals = await page.evaluate(() => {
        let elements = document.querySelectorAll('section.tGrid article.thread:not(.thread--expired)')
        let length = elements.length
        let deals = []
        for (let i = 0; i < length; i++) {
            let element = elements[i]
            let titleEl = element.querySelector('.thread-title a')
            let title = (titleEl ? titleEl.textContent.trim() : null || 'No title found').split(' ').splice(0, 7).join(' ') + '...'
            let url = titleEl ? titleEl.href : null
            let id = url ? url.split('-').reverse()[0] : null
            let temperatureEl = element.querySelector('.vote-temp')
            let temperature = temperatureEl ? parseInt(temperatureEl.textContent.trim()) : null
            let merchantEl = element.querySelector('.cept-merchant-name')
            let merchant = merchantEl ? merchantEl.textContent.trim() : null
            let priceEl = element.querySelector('.thread-price')
            let price = priceEl ? priceEl.textContent.trim() : null
            if (title && id && url && temperature && merchant) {
                deals.push({ id: id, title: title, url: url, temperature: temperature, merchant: merchant, price: price })
            }
        }
        return deals
    })

    log(deals.length + ' deals found')
    // filter by temperature
    deals = deals.filter(deal => {
        if (verbose) {
            log(deal.temperature + '° | ' + deal.title)
        }
        return deal.temperature && (deal.temperature > temperatureMin)
    })
    log(deals.length + ' deals above ' + temperatureMin + '°')
    // filter sent
    deals = deals.filter(deal => {
        const dealAlreadySent = (dealsSent.indexOf(deal.id) !== -1)
        if (verbose) {
            log((dealAlreadySent ? 'Avoid re-sending deal' : 'Brand new deal') + ' ' + deal.id + ' "' + deal.title + '" ' + deal.price + ' @ ' + deal.merchant)
        }
        return !dealAlreadySent
    })
    log(deals.length + ' deals not sent yet')
    // filter if limit specified
    if (limit && limit < deals.length) {
        deals = deals.splice(0, limit)
        log(deals.length + ' deals after limit')
    }
    log(deals.length + ' deals will be sent to IFTTT')
    browser.close()

    // send deals at 1 second interval
    deals.forEach((deal, index) => {
        setTimeout(() => postDeal(deal), index * 1000)
        if (index === (deals.length - 1) && useInterval) {
            // last iteration
            setTimeout(logNextSrap, (index * 1000) + 1000)
        }
    })
    // if no deals found
    if (!deals.length && useInterval) {
        // still display next planned scrap
        logNextSrap()
    }
}

// start now
scrape()
if (useInterval) {
    // every X hours
    setInterval(scrape, 1000 * 60 * 60 * hoursBetweenRuns)
}
