window.MIRACOLO_V5 = Object.freeze({
  version: '5.0.0',
  refreshMinutes: 5,
  layout: { menu: 'top', mobileReference: 'screenshot-inspired', dark: true },
  home: { focus: 'protection', primary: 'black-swan-risk' },
  alerts: {
    enabled: true,
    levels: ['NORMAL','WATCH','WARNING','ALERT','BLACK SWAN'],
    blackSwanMinScore: 70,
    requireMultiSignalConfirmation: true,
    notifyOnlyOnMeaningfulChange: true
  },
  portfolio: { enabled: true, impactAnalysis: true },
  tabs: ['dashboard','investimenti','bot','news','analisi','learning','alert','config']
});