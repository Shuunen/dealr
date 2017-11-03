const fs = require('fs')
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'))
const puppeteer = require('puppeteer')
const request = require('request')
const dealsSentFile = 'deals-sent.log'
let dealsSent

try {
    dealsSent = fs.readFileSync(dealsSentFile, 'utf8').trim().split('\n')
    console.log('Deals already sent :', dealsSent)
} catch (e) {
    fs.writeFileSync(dealsSentFile, '', function (err) {
        if (err) {
            return console.error(err)
        }
    })
}

function postDeal(deal) {
    if (dealsSent.indexOf(deal.id) === -1) {
        dealsSent.push(deal.id)
        fs.appendFileSync(dealsSentFile, deal.id + '\n')
        console.log('New deal "' + deal.title + '" will be sent')
    } else {
        console.log('Deal "' + deal.title + '" with id "' + deal.id + '" already sent')
        return
    }
    request({
        uri: config.iftttWebhook,
        method: 'POST',
        json: {
            'value1': deal.url
        }
    }, function (error, response, body) {
        if (error) console.log('postDeal error :', error)
        else console.log('postDeal success :', body)
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
    const browser = await puppeteer.launch({ headless: false })
    const page = await browser.newPage()

    await page.goto('https://www.dealabs.com/hot')
    await page.waitFor(800)
    // await scroll(page)
    // await scroll(page)
    // await scroll(page)

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
                    url: title.href,
                    temperature: temperature ? parseInt(temperature.textContent.trim()) : 100,
                    merchant: merchant ? merchant.textContent.trim() : ''
                })
            }
        }
        return deals
    })

    console.log(deals.length, 'deals extracted')
    deals = deals.filter(deal => deal.temperature > 200)
    if (limit) {
        deals = deals.splice(0, limit)
    }
    console.log(deals.length, 'deals filtered')

    await browser.close()

    return deals
}

scrape().then((deals) => {
    // console.log(deals) // Success!
    deals.map(deal => postDeal(deal))
})
