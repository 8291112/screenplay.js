import { setWorldConstructor, Before, After } from '@cucumber/cucumber'
import { AppElements } from '@cucumber/electron'
import { ActorWorld, makeInteractionLoader, defineActorParameterType } from '../../src/index'

import Shouty from '../src/Shouty'
import { makeApp } from '../src/server'
import { promisify } from 'util'
import { MessagesHeard, MoveTo, Shout } from './interactions/types'

defineActorParameterType()

type Stop = () => Promise<unknown>

export default class World extends ActorWorld {
  public readonly shouty = new Shouty()
  public readonly apiPort = 8080
  public readonly stops: Stop[] = []

  public readonly appElements = new AppElements()

  // Screenplay Interactions
  public moveTo: MoveTo
  public shout: Shout
  public messagesHeard: MessagesHeard
}

setWorldConstructor(World)

Before(async function (this: World) {
  const interactionsDir = `${__dirname}/interactions/${process.env.CUCUMBER_SCREENPLAY_INTERACTIONS || 'direct'}`
  const interaction = makeInteractionLoader(interactionsDir)

  this.moveTo = await interaction('moveTo')
  this.shout = await interaction('shout')
  this.messagesHeard = await interaction('messagesHeard')
})

Before(async function (this: World) {
  if (!process.env.KEEP_DOM) {
    this.stops.push(async () => this.appElements.destroyAll())
  }

  if (process.env.CUCUMBER_SCREENPLAY_INTERACTIONS === 'http') {
    const app = makeApp()

    await new Promise<void>((resolve, reject) => {
      app.on('error', reject)

      const server = app.listen(this.apiPort, resolve)
      const stopServer = promisify(server.close.bind(server)) as Stop
      this.stops.push(stopServer)
    })
  }
})

After(async function (this: World) {
  await Promise.all(this.stops.reverse().map((stop) => stop()))
})
