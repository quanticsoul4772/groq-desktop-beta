module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: '18',
        electron: '37'
      }
    }],
    ['@babel/preset-react', {
      runtime: 'automatic'
    }]
  ],
  env: {
    test: {
      presets: [
        ['@babel/preset-env', {
          targets: {
            node: 'current'
          }
        }],
        ['@babel/preset-react', {
          runtime: 'automatic'
        }]
      ]
    }
  }
};