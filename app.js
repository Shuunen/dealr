const fs = require('fs')
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'))
const puppeteer = require('puppeteer')
const request = require('request')
const hoursBetweenRuns = 3
const dealsSentFile = 'deals-sent.log'
let dealsSent

let log = (str) => console.log(time() + ' : ' + str)

let time = (addHours = 0) => {
    const date = new Date()
    date.setHours(date.getHours() + addHours);
    const hours = date.getHours() + ''
    const minutes = date.getMinutes() + ''
    return (hours.length === 1 ? '0' : '') + hours + 'h' + (minutes.length === 1 ? '0' : '') + minutes
}

try {
    dealsSent = fs.readFileSync(dealsSentFile, 'utf8').trim().split('\n')
    log('Found ' + dealsSent.length + ' deals already sent in ' + dealsSentFile)
} catch (e) {
    fs.writeFileSync(dealsSentFile, '', function (err) {
        if (err) {
            return console.error(err)
        }
    })
}

let postDeal = (deal) => {
    if (dealsSent.indexOf(deal.id) !== -1) {
        log('Avoid re-sending deal ' + deal.id + ' "' + deal.titleShort + '"')
        return
    } else {
        log('Sending brand new deal ' + deal.id + ' "' + deal.titleShort + '"')
    }
    request({
        uri: config.iftttWebhook,
        method: 'POST',
        json: {
            'value1': deal.url
        }
    }, function (error, response, body) {
        if (error) {
            log('postDeal error : ' + error)
        } else {
            // all went good
            dealsSent.push(deal.id)
            fs.appendFileSync(dealsSentFile, deal.id + '\n')
        }
    })
}

function scroll(page) {
    return page.evaluate(() => {
        return new Promise(resolve => {
            window.scrollTo(0, document.body.scrollHeight)
            setTimeout(() => resolve(), 500)
        })
    })
}

let scrape = async (limit = null) => {
    log('Start deals scrapping...')
    const browser = await puppeteer.launch({ headless: true })
    const page = await browser.newPage()

    await page.goto('https://www.dealabs.com/hot')
    await page.waitFor(800)
    await scroll(page)
    await scroll(page)
    await scroll(page)

    let deals = await page.evaluate(() => {
        let elements = document.querySelectorAll('section.thread-list--type-list article.thread.thread--type-list')
        let length = elements.length
        let deals = []
        for (let i = 0; i < length; i++) {
            let element = elements[i]
            let title = element.querySelector('.thread-link.cept-tt')
            let id = title.href.split('-').reverse()[0]
            let temperature = element.querySelector('.vote-temp')
            let merchant = element.querySelector('.cept-merchant-name')
            if (id) {
                deals.push({
                    id: id,
                    title: title.textContent.trim(),
                    titleShort: title.textContent.trim().split(' ').splice(0, 7).join(' ') + '...',
                    url: title.href,
                    temperature: temperature ? parseInt(temperature.textContent.trim()) : 100,
                    merchant: merchant ? merchant.textContent.trim() : ''
                })
            }
        }
        return deals
    })

    log(deals.length + ' deals found')
    const temperatureMin = 300
    deals = deals.filter(deal => deal.temperature > temperatureMin)
    log(deals.length + ' deals above ' + temperatureMin + '°')
    if (limit) {
        deals = deals.splice(0, limit)
    }
    log(deals.length + ' deals with limit')

    await browser.close()

    // send deals at 1 second interval
    deals.forEach((deal, index) => {
        setTimeout(() => postDeal(deal), index * 1000)
        if (index === (deals.length - 1)) {
            // last iteration
            setTimeout(() => log('Next execution planned in ' + hoursBetweenRuns + ' hours at ' + time(hoursBetweenRuns)), (index * 1000) + 1000)
        }
    })
}

scrape() // start now
setInterval(scrape, 1000 * 60 * 60 * hoursBetweenRuns) // and then every X hours


