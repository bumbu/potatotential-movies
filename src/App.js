import React, { Component } from 'react';
import './App.css';
import Cookies from 'js-cookie';
import FileSize from 'file-size';

const PROXY_PATH = process.env.NODE_ENV === 'production' ? '/proxy' : '';

class App extends Component {
  state = {
    temporaryClientID: '',
    askForClientId: false,
    step: 'START',
    userCode: null,
    verificationURL: null,
    movies: [],
  }

  componentDidMount() {
    this.loadEverything()
  }

  render() {
    return (
      <div className="App">
        {this.state.askForClientId ? <div>
          <div>Go to <a href="https://simkl.com/settings/developer/" target="_blank">simkl.com/settings/developer/</a>, create a new app (with PIN auth) and past the client ID here</div>
          Client ID: <input
            type="text"
            value={this.state.temporaryClientID}
            onChange={this.onClientIDChange}/>
            <button onClick={this.onSaveClientID}>Save</button>
        </div> :
        <div>
          {this.state.userCode ?
            <div>
              Insert code: {this.state.userCode} <a href={this.state.verificationURL} target="_blank">here</a>
            </div> :
            null
          }
          <h2>Movies</h2>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Year</th>
                <th>Quality</th>
              </tr>
            </thead>
            <tbody>
              {this.state.movies.map((movie) => {
                return <tr key={movie.ids.simkl}>
                  <td>{movie.title}</td>
                  <td>{movie.year}</td>
                  <td>{movie.meta != null ?
                    <div>
                      {movie.meta.items.map(item => {
                        return <React.Fragment>
                          <a key={item.id} href={item.torrent_magnet}>{item.quality} ({item.torrent_seeds}/{item.torrent_peers}) {FileSize(item.size_bytes).human()}</a>
                          <br/>
                        </React.Fragment>
                      })}
                    </div> :
                    null}</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>}
      </div>
    );
  }

  loadEverything = () => {
    this
      .getClientID()
      .then(this.getAccessToken)
      .then(this.loadMovies)
  }

  onClientIDChange = (ev) => {
    this.setState({temporaryClientID: ev.target.value})
  }

  onSaveClientID = (ev) => {
    ev.preventDefault();
    Cookies.set('clientID', this.state.temporaryClientID);
    this.setState({askForClientId: false})
    this.loadEverything()
  }

  getClientID = () => {
    if (Cookies.get('clientID') == null) {
      this.setState({askForClientId: true})
      return Promise.reject('No client ID')
    } else {
      return Promise.resolve(Cookies.get('clientID'));
    }
  }

  getAccessToken = (clientID) => {
    if (Cookies.get('accessToken') == null) {
      return fetch(`${PROXY_PATH}/oauth/pin?client_id=${clientID}`)
        .then(resp => resp.json())
        .then(data => {
          this.setState({
            verificationURL: data.verification_url,
            userCode: data.user_code,
          })
          return data;
        })
        .then(data => new Promise((resolve, reject) => {
          // Get Access Token
          const start = Date.now();
          const isOverTime = () => (Date.now() - start > data.expires_in * 1000);
          let timer = setInterval(() => {
          fetch(`${PROXY_PATH}/oauth/pin/${data.user_code}?client_id=${clientID}`)
            .then(resp => resp.json())
            .then(data => {
              if (data.result === 'OK') {
                clearInterval(timer);
                resolve(data.access_token);
              } else if (isOverTime()) {
                reject('Timeout')
              }
            })
            .catch(error => {
              if (isOverTime()) {
                reject('Timeout from catch')
              }
            });
          }, data.interval * 1000);
        }))
        .then(accessToken => {
          Cookies.set('accessToken', accessToken);
          return {clientID, accessToken: accessToken};
        })
    } else {
      return Promise.resolve({clientID, accessToken: Cookies.get('accessToken')});
    }
  }

  loadMovies = ({clientID, accessToken}) => {
    return fetch(`${PROXY_PATH}/sync/all-items/movies/plantowatch`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "simkl-api-key": clientID,
        "Authorization": `Bearer ${accessToken}`,
      },
    }).then(response => response.json())
      .then(data => {
        const movies = data.movies.map(m => m.movie);
        this.setState({movies})
        return movies
      })
      .then(movies => {
        // console.log(movies)
        for (const movie of movies) {
          // Request status of each movie
          if (movie.ids.imdb != null) {
            fetch(`https://api.apiumando.info/movie?cb=&quality=720p,1080p&page=undefined&imdb=${movie.ids.imdb}`)
              .then(response => response.json())
              .then(movieMeta => {
                // Update state
                this.setState(state => {
                  return {movies: state.movies.map((movie) => {
                    if (movie.ids.imdb === movieMeta.imdb) {
                      return {...movie, meta: movieMeta}
                    } else {
                      return movie;
                    }
                  })}
                })
              })
              .catch(error => {
                console.log(error)
              })
          }
        }
      })
  }
}

export default App;
