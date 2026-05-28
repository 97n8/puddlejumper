import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PublicPermitBridgePage } from '@/features/permitbridge/PublicPermitBridgePage'
import {
  PERMITBRIDGE_APP_ORIGIN,
  getEmbeddedPermitBridgeUrl,
  isPermitBridgePathname,
} from '@/features/permitbridge/permitBridgeRoutes'

const {
  registryTownMock,
  mmaProfileMock,
  massgisMock,
  legislationMock,
  fiscalSyncMock,
  logicdashStatsMock,
  logicdashDeadlinesMock,
  logicdashActivityMock,
} = vi.hoisted(() => ({
  registryTownMock: vi.fn(),
  mmaProfileMock: vi.fn(),
  massgisMock: vi.fn(),
  legislationMock: vi.fn(),
  fiscalSyncMock: vi.fn(),
  logicdashStatsMock: vi.fn(),
  logicdashDeadlinesMock: vi.fn(),
  logicdashActivityMock: vi.fn(),
}))

vi.mock('@/services/pjApi', () => ({
  pjApi: {
    registry: {
      town: registryTownMock,
      mmaProfile: mmaProfileMock,
      massgis: massgisMock,
      legislation: legislationMock,
    },
    fiscal: {
      sync: fiscalSyncMock,
    },
    logicdash: {
      stats: logicdashStatsMock,
      deadlines: logicdashDeadlinesMock,
      activity: logicdashActivityMock,
    },
  },
}))

describe('PermitBridge public page', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/permitbridge/apply/residential?town=gardner&envId=env-gardner#checklist')
    registryTownMock.mockResolvedValue({
      name: 'Gardner',
      dorCode: 276,
      population: 20892,
      county: 'Worcester',
      fiscal: {
        fiscalYear: 2026,
        computedAt: '2026-04-01T12:00:00.000Z',
        metrics: {
          operatingBudget: 37_850_000,
          freeCash: 1_200_000,
          totalEmployees: 332,
          totalStateAid: 3_400_000,
        },
      },
      staff: {
        employees: [
          { id: '1', name: 'Alex Clerk', title: 'Town Clerk', email: 'clerk@gardner-ma.gov', phone: '978-111-1111', sourceUrl: 'https://gardner-ma.gov/staff' },
        ],
        sourcePages: ['https://gardner-ma.gov/staff'],
        scrapedAt: '2026-04-01T12:00:00.000Z',
      },
    })
    mmaProfileMock.mockResolvedValue({
      source: 'cache',
      profile: {
        slug: 'gardner',
        fetchedAt: '2026-04-01T12:00:00.000Z',
        website: 'www.gardner-ma.gov',
        phone: '978-630-1490',
        formOfGovernment: 'Mayor-Council',
        legislativeBody: 'City Council',
        chiefMunicipalOfficial: 'Michael Nicholson',
        selectBoardChair: 'Council President',
        annualTownMeetingDate: '2026-05-12',
        municipalElectionDate: '2026-11-03',
        maSenatorsors: ['John Cronin'],
        maRepresentatives: ['Jonathan Zlotnik'],
        usRepresentative: ['James McGovern'],
      },
    })
    massgisMock.mockResolvedValue({
      source: 'cache',
      data: {
        town: 'Gardner',
        townId: 276,
        type: 'city',
        county: 'Worcester',
        fipsStateCo: 25027,
        areaSqMi: 22.3,
        areaAcres: 14272,
        pop2020: 20892,
        popChange1020: 1.7,
        fetchedAt: '2026-04-01T12:00:00.000Z',
      },
    })
    legislationMock.mockResolvedValue({
      source: 'cache',
      fetchedAt: '2026-04-01T12:00:00.000Z',
      bills: [
        {
          billNumber: 'H.4123',
          docketNumber: 'HD.4123',
          title: 'An Act relative to municipal permit modernization in Gardner',
          primarySponsor: 'Jonathan Zlotnik',
          cosponsors: [],
          branch: 'House',
        },
      ],
    })
    fiscalSyncMock.mockResolvedValue({
      metrics: {
        operatingBudget: 37_850_000,
        certifiedFreeCash: 1_200_000,
        totalEmployees: 332,
        totalStateAid: 3_400_000,
      },
      fiscalYear: 2026,
      computedAt: '2026-04-01T12:00:00.000Z',
    })
    logicdashStatsMock.mockResolvedValue({
      openRecords: 8,
      overdueRecords: 2,
      dueThisWeek: 3,
      sealedThisMonth: 5,
    })
    logicdashDeadlinesMock.mockResolvedValue({
      items: [
        { id: 'd1', recordId: 'r1', title: 'Conservation hearing', moduleId: 'permits', daysRemaining: 4, dueDate: '2026-05-04', urgency: 'soon' },
      ],
    })
    logicdashActivityMock.mockResolvedValue({
      events: [
        {
          eventId: 'evt-1',
          requestId: 'req-1',
          tenantId: 'tenant-1',
          module: 'permits',
          eventType: 'record.updated',
          severity: 'info',
          actor: { userId: 'u1', role: 'admin', sessionId: 's1' },
          timestamp: '2026-04-02T12:00:00.000Z',
          chainPos: 1,
          hash: 'hash',
          prevHash: 'prev',
          data: {},
        },
      ],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('matches every supported public entry alias', () => {
    expect(isPermitBridgePathname('/permitbridge')).toBe(true)
    expect(isPermitBridgePathname('/permit-bridge/inspections')).toBe(true)
    expect(isPermitBridgePathname('/permit&bridge/review')).toBe(true)
    expect(isPermitBridgePathname('/permitting')).toBe(false)
  })

  it('preserves nested path, query string, and hash in the embedded app url', () => {
    expect(getEmbeddedPermitBridgeUrl('/permitbridge/apply/residential', '?town=gardner&envId=env-gardner', '#checklist'))
      .toBe(`${PERMITBRIDGE_APP_ORIGIN}/apply/residential?town=gardner&envId=env-gardner#checklist`)
  })

  it('uses a clean generic title on the front door route', () => {
    window.history.replaceState({}, '', '/permitbridge')

    render(<PublicPermitBridgePage />)

    expect(screen.getByRole('heading', { name: /permit front door/i })).toBeInTheDocument()
    expect(screen.queryByText(/permit permit/i)).not.toBeInTheDocument()
  })

  it('renders the upgraded shell around the embedded app', async () => {
    render(<PublicPermitBridgePage />)

    expect(screen.getByText(/launching permit&bridge/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open standalone route/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /return to logicos/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /town front door/i })).toHaveAttribute('href', '/permitbridge/apply/residential?town=gardner&envId=env-gardner#checklist')
    expect(screen.getByRole('link', { name: /open exact process/i })).toHaveAttribute('href', `${PERMITBRIDGE_APP_ORIGIN}/apply/residential?town=gardner&envId=env-gardner#checklist`)
    expect(await screen.findByRole('link', { name: /town website/i })).toHaveAttribute('href', 'https://www.gardner-ma.gov')
    expect(await screen.findByRole('link', { name: /contact permit desk/i })).toHaveAttribute('href', 'mailto:clerk@gardner-ma.gov')

    expect(screen.getByTitle('Permit&Bridge')).toHaveAttribute(
      'src',
      `${PERMITBRIDGE_APP_ORIGIN}/apply/residential?town=gardner&envId=env-gardner#checklist`,
    )
  })

  it('pulls town-specific briefing data into the shell', async () => {
    render(<PublicPermitBridgePage />)

    await waitFor(() => {
      expect(registryTownMock).toHaveBeenCalledWith('Gardner')
    })
    expect(mmaProfileMock).toHaveBeenCalledWith('Gardner')
    expect(massgisMock).toHaveBeenCalledWith('Gardner')
    expect(legislationMock).toHaveBeenCalledWith('Gardner')
    expect(logicdashStatsMock).toHaveBeenCalledWith('env-gardner')

    expect(await screen.findByText(/one track from first click to final record/i)).toBeInTheDocument()
    expect(screen.getByText(/same town, same permit, and same source trail/i)).toBeInTheDocument()
    expect(screen.getByText('gardner-ma.gov')).toBeInTheDocument()
    expect(screen.getAllByText(/an act relative to municipal permit modernization in gardner/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/alex clerk/i).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByText(/town context/i))

    expect(await screen.findByText('$37,850,000')).toBeInTheDocument()
    expect(screen.getByText('$1,200,000')).toBeInTheDocument()
    expect(screen.getByText('332')).toBeInTheDocument()

    fireEvent.click(screen.getByText(/municipal notes/i))

    expect(await screen.findByText(/permit intake still runs on local charter/i)).toBeInTheDocument()
  })

  it('shows the about tab explainer', async () => {
    render(<PublicPermitBridgePage />)

    fireEvent.click(screen.getByRole('button', { name: /about/i }))

    expect(await screen.findByText(/this page stays intentionally light/i)).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('handles the live permit work'))).toBeInTheDocument()
  })

  it('clears the launch overlay once the iframe reports ready', () => {
    render(<PublicPermitBridgePage />)

    fireEvent.load(screen.getByTitle('Permit&Bridge'))

    expect(screen.queryByText(/launching permit&bridge/i)).not.toBeInTheDocument()
  })

  it('shows slower-load guidance when the embedded app takes a moment', () => {
    vi.useFakeTimers()
    render(<PublicPermitBridgePage />)

    act(() => {
      vi.advanceTimersByTime(3200)
    })

    expect(screen.getByText(/taking longer than usual/i)).toBeInTheDocument()
  })
})
