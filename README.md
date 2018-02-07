<img src="logo.gif" width="533">

# Daily deals without clutter.

## How it works
Dealr use puppeteer headless to scrap the deals on the web page, then post each new deal to IFTTT webhook.


## How to use it
Create a `config.json` file with the IFTTT webhook url, eg :
```
{
    "iftttWebhook": "https://maker.ifttt.com/trigger/new_deal/with/key/MY_SECRET_GARDEN"
}
```
Then install dependencies & start Dealr :
`npm install` then `npm start` or `npm run dev` to watch for changes in app.js

## TODO
* [ ] find another way to centralise posted deals
