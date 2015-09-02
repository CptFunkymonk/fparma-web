/* Parses uploaded sqm files for units. Returns JSON*/

import armaClassParser from 'arma-class-parser'
import _ from 'lodash'

const ALLOWED_SIDES = ['WEST', 'EAST', 'GUER', 'CIV']
const PLAYABLE_TYPES = ['PLAY CDG', 'PLAYER COMMANDER']
const SIDE_TRANSLATE_MAP = {
  WEST: 'blufor',
  EAST: 'opfor',
  GUER: 'greenfor',
  CIV: 'civilian'
}

let isAllowedSide = str => _.includes(ALLOWED_SIDES, (str || '').toUpperCase())
let isUnitPlayable = str => _.includes(PLAYABLE_TYPES, (str || '').toUpperCase())
let translateSide = str => SIDE_TRANSLATE_MAP[(str + '').toUpperCase()] || null
let parseGroupName = str => {
  str = str + ''
  let ret = ''
  // might be better with a regexp here
  let match = str.substr(str.toLowerCase().lastIndexOf('setgroupid'))
  if (match) {
    // semicolon could be missing if last command
    match = match.substr(match.indexOf('[') + 1, (match.indexOf(';') || match.length))
    match = match.substr(0, match.lastIndexOf(']'))
    ret = match.replace(/['"]+/g, '')
  }

  return _.capitalize(ret.toLowerCase().trim())
}

export default function (sqmFileString, callback) {
  if (!_.isString(sqmFileString)) return callback(new Error('Expected SQM file as string'))
  if (!_.isFunction(callback)) return callback(new Error('Missing callback'))
  let ret = []
  let parsed

  try {
    parsed = armaClassParser(sqmFileString)
  } catch (e) {
    return callback(new Error('SQM file could not be parsed'))
  }

  // empty sqm?
  if (!parsed.Mission || !parsed.Mission.Groups) return callback(new Error('Could not find any groups in SQM file'))
  process.nextTick(() => {
    _.forOwn(parsed.Mission.Groups, val => {
      if (_.isEmpty(val.Vehicles) || !isAllowedSide(val.side)) return

      let grp = {units: []}
      _.forOwn(val.Vehicles, unit => {
        if (_.isEmpty(unit) || !isAllowedSide(unit.side) || !isUnitPlayable(unit.player)) return

        if (unit.leader) {
          grp.side = translateSide(_.escape(unit.side))
          grp.name = _.escape(parseGroupName(unit.init) || '')
        }

        grp.units.push({
          description: _.escape(unit.description || '').trim()
        })
      })

      if (grp.units.length) {
        if (grp.name) {
          let grpNameReg = new RegExp(grp.name, 'i')
          grp.units.forEach(unit => {
            let orig = unit.description
            if (orig.toLowerCase().indexOf(grp.name.toLowerCase()) === 0) {
              let desc = orig.replace(grpNameReg, '').trim()
              unit.description = desc || orig
            }
          })
        }
        ret.push(grp)
      }
    })

    callback(null, ret)
  })
}
