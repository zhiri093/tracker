const { aql } = require('arangojs')
const { fromGlobalId, toGlobalId } = require('graphql-relay')
const { t } = require('@lingui/macro')

const orgLoaderConnectionArgsByDomainId = (
  query,
  language,
  userId,
  cleanseInput,
  i18n,
) => async ({ domainId, after, before, first, last }) => {
  let afterTemplate = aql``
  let beforeTemplate = aql``

  const userDBId = `users/${userId}`

  if (typeof after !== 'undefined') {
    const { id: afterId } = fromGlobalId(cleanseInput(after))
    afterTemplate = aql`FILTER TO_NUMBER(org._key) > TO_NUMBER(${afterId})`
  }

  if (typeof before !== 'undefined') {
    const { id: beforeId } = fromGlobalId(cleanseInput(before))
    beforeTemplate = aql`FILTER TO_NUMBER(org._key) < TO_NUMBER(${beforeId})`
  }

  let limitTemplate = aql``
  if (typeof first === 'undefined' && typeof last === 'undefined') {
    console.warn(
      `User: ${userId} did not have either \`first\` or \`last\` arguments set for: orgLoaderConnectionArgsByDomainId.`,
    )
    throw new Error(
      i18n._(
        t`You must provide a \`first\` or \`last\` value to properly paginate the \`organization\` connection.`,
      ),
    )
  } else if (first < 0 || last < 0) {
    const argSet = typeof first !== 'undefined' ? 'first' : 'last'
    console.warn(
      `User: ${userId} attempted to have \`${argSet}\` set below zero for: orgLoaderConnectionArgsByDomainId.`,
    )
    throw new Error(
      i18n._(
        t`\`${argSet}\` on the \`organization\` connection cannot be less than zero.`,
      ),
    )
  } else if (first > 100 || last > 100) {
    const argSet = typeof first !== 'undefined' ? 'first' : 'last'
    const amount = typeof first !== 'undefined' ? first : last
    console.warn(
      `User: ${userId} attempted to have \`${argSet}\` to ${amount} for: orgLoaderConnectionArgsByDomainId.`,
    )
    throw new Error(
      i18n._(
        t`Requesting \`${amount}\` records on the \`organization\` connection exceeds the \`${argSet}\` limit of 100 records.`,
      ),
    )
  } else if (typeof first !== 'undefined' && typeof last === 'undefined') {
    limitTemplate = aql`SORT org._key ASC LIMIT TO_NUMBER(${first})`
  } else if (typeof first === 'undefined' && typeof last !== 'undefined') {
    limitTemplate = aql`SORT org._key DESC LIMIT TO_NUMBER(${last})`
  } else {
    console.warn(
      `User: ${userId} attempted to have \`first\` and \`last\` arguments set for: orgLoaderConnectionArgsByDomainId.`,
    )
    throw new Error(
      i18n._(
        t`Passing both \`first\` and \`last\` to paginate the \`organization\` connection is not supported.`,
      ),
    )
  }

  let sortString
  if (typeof last !== 'undefined') {
    sortString = aql`DESC`
  } else {
    sortString = aql`ASC`
  }

  let organizationInfoCursor
  try {
    organizationInfoCursor = await query`
    LET superAdmin = (FOR v, e IN 1 INBOUND ${userDBId} affiliations FILTER e.permission == "super_admin" RETURN e.permission)
    LET affiliationKeys = (FOR v, e IN 1..1 INBOUND ${userDBId} affiliations RETURN v._key)
    LET superAdminOrgs = (FOR org IN organizations RETURN org._key)
    LET keys = ('super_admin' IN superAdmin ? superAdminOrgs : affiliationKeys)
    LET claimKeys = (FOR v, e IN 1..1 INBOUND ${domainId} claims RETURN v._key)
    LET orgKeys = INTERSECTION(keys, claimKeys)

    LET retrievedOrgs = (
      FOR org IN organizations
        FILTER org._key IN orgKeys
        ${afterTemplate} 
        ${beforeTemplate} 
        ${limitTemplate}
        LET domains = (FOR v, e IN 1..1 OUTBOUND org._id claims RETURN e._to)
        RETURN MERGE({ _id: org._id, _key: org._key, _rev: org._rev, blueCheck: org.blueCheck, domainCount: COUNT(domains) }, TRANSLATE(${language}, org.orgDetails))
    )

    LET hasNextPage = (LENGTH(
      FOR org IN organizations
        FILTER org._key IN orgKeys
        FILTER TO_NUMBER(org._key) > TO_NUMBER(LAST(retrievedOrgs)._key)
        SORT org._key ${sortString} LIMIT 1
        RETURN org
    ) > 0 ? true : false)
    
    LET hasPreviousPage = (LENGTH(
      FOR org IN organizations
        FILTER org._key IN orgKeys
        FILTER TO_NUMBER(org._key) < TO_NUMBER(FIRST(retrievedOrgs)._key)
        SORT org._key ${sortString} LIMIT 1
        RETURN org
    ) > 0 ? true : false)
    
    RETURN { 
      "organizations": retrievedOrgs,
      "hasNextPage": hasNextPage, 
      "hasPreviousPage": hasPreviousPage, 
      "startKey": FIRST(retrievedOrgs)._key, 
      "endKey": LAST(retrievedOrgs)._key 
    }
    `
  } catch (err) {
    console.error(
      `Database error occurred while user: ${userId} was trying to gather orgs in orgLoaderConnectionArgsByDomainId.`,
    )
    throw new Error(i18n._(t`Unable to load organizations. Please try again.`))
  }

  let organizationInfo
  try {
    organizationInfo = await organizationInfoCursor.next()
  } catch (err) {
    console.error(
      `Cursor error occurred while user: ${userId} was trying to gather orgs in orgLoaderConnectionArgsByDomainId.`,
    )
    throw new Error(i18n._(t`Unable to load organizations. Please try again.`))
  }

  if (organizationInfo.organizations.length === 0) {
    return {
      edges: [],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: '',
        endCursor: '',
      },
    }
  }

  const edges = organizationInfo.organizations.map((organization) => {
    organization.id = organization._key
    return {
      cursor: toGlobalId('organizations', organization._key),
      node: organization,
    }
  })

  return {
    edges,
    pageInfo: {
      hasNextPage: organizationInfo.hasNextPage,
      hasPreviousPage: organizationInfo.hasPreviousPage,
      startCursor: toGlobalId('organizations', organizationInfo.startKey),
      endCursor: toGlobalId('organizations', organizationInfo.endKey),
    },
  }
}

module.exports = {
  orgLoaderConnectionArgsByDomainId,
}
