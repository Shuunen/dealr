const fs = require('fs')
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'))
const puppeteer = require('puppeteer')
const request = require('request')
const hoursBetweenRuns = 3
const temperatureMin = 300
const dealsSentFile = 'deals-sent.log'
const verbose = false
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
    const dealAlreadySent = (dealsSent.indexOf(deal.id) !== -1)
    log((dealAlreadySent ? 'Avoid re-sending deal' : 'Sending brand new deal') + ' ' + deal.id + ' "' + deal.title + '"')
    if (dealAlreadySent) return
    const options = { uri: config.iftttWebhook, method: 'POST', json: { value1: deal.url } }
    request(options, (error) => {
        if (error) { log('postDeal error : ' + error) } else { // all went good
            dealsSent.push(deal.id)
            fs.appendFileSync(dealsSentFile, deal.id + '\n')
        }
    })
}

const logNextSrap = () => log('Next execution planned in ' + hoursBetweenRuns + ' hours at ' + time(hoursBetweenRuns))

const scroll = (page) => page.evaluate(() => new Promise(resolve => {
    window.scrollTo(0, document.body.scrollHeight)
    setTimeout(() => resolve(), 500)
}))

const scrape = async (limit = null) => {
    log('Start deals scrapping...')
    const browser = await puppeteer.launch({ headless: true })
    const page = await browser.newPage()

    await page.goto('https://www.dealabs.com/hot')
    await page.waitFor(800)
    await scroll(page)
    await scroll(page)
    await scroll(page)

    let deals = await page.evaluate(() => {
        let elements = document.querySelectorAll('section.thread-list--type-list article.thread')
        let length = elements.length
        let deals = []
        for (let i = 0; i < length; i++) {
            let element = elements[i]
            let titleEl = element.querySelector('.thread-title a')
            let title = (titleEl ? titleEl.textContent.trim() : null || 'No title found').split(' ').splice(0, 7).join(' ') + '...'
            let id = titleEl.href.split('-').reverse()[0]
            let url = titleEl.href
            let temperatureEl = element.querySelector('.vote-temp')
            let temperature = temperatureEl ? parseInt(temperatureEl.textContent.trim()) : 100
            let merchantEl = element.querySelector('.cept-merchant-name')
            let merchant = merchantEl ? merchantEl.textContent.trim() : ''
            deals.push({ id: id, title: title, url: url, temperature: temperature, merchant: merchant })
        }
        return deals
    })

    log(deals.length + ' deals found')
    deals = deals.filter(deal => {
        if (verbose) {
            log(deal.temperature + '° | ' + deal.title)
        }
        return deal.temperature && (deal.temperature > temperatureMin)
    })
    log(deals.length + ' deals above ' + temperatureMin + '°')
    if (limit) {
        deals = deals.splice(0, limit)
    }
    log(deals.length + ' deals after limit')

    browser.close()

    // send deals at 1 second interval
    deals.forEach((deal, index) => {
        setTimeout(() => postDeal(deal), index * 1000)
        if (index === (deals.length - 1)) {
            // last iteration
            setTimeout(logNextSrap, (index * 1000) + 1000)
        }
    })
    // if no deals found
    if (!deals.length) {
        // still display next planned scrap
        logNextSrap()
    }
}

// start now
scrape()
// and then every X hours
setInterval(scrape, 1000 * 60 * 60 * hoursBetweenRuns)


