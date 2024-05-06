import consola from 'consola'
import { renderAPI } from '../api'

renderAPI().catch(consola.error)
