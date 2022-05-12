import { Drive, list as listDrives, Mountpoint } from 'drivelist'
import {
  promises,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from 'fs'
import Registry from 'rage-edit'
import React, { useEffect, useRef, useState } from 'react'
import DriveIconSystem from '../assets/drive-system.png'
import DriveIcon from '../assets/drive.png'
import Logo from '../assets/logo.png'
import pkg from '../package.json'
import toIco from 'to-ico'
import { nanoid } from 'nanoid'

interface SimplifiedDrive {
  letter: string
  icon: { path?: string; src: any }
  isSystem: boolean
  description: string
  isUSB: boolean
}

const IconRegistry = new Registry(
  'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\DriveIcons'
)

const DEFAULT_VALUE = ''

const getDriveLetter = (m: Mountpoint) => m.path.split(':')[0]

const getDriveIconKey = (letter: string) => `\\${letter}\\DefaultIcon`

const setDriveIcon = (letter: string, iconPath: string) => {
  IconRegistry.set(getDriveIconKey(letter), DEFAULT_VALUE, iconPath)
}

const getIcon = async (drive: Drive, m: Mountpoint) => {
  const key = getDriveIconKey(getDriveLetter(m))

  if (await IconRegistry.has(key)) {
    const iconPath = await IconRegistry.get(key, DEFAULT_VALUE)

    const iconUrl = await promises.readFile(iconPath, { encoding: 'base64' })

    return { path: iconPath, src: `data:image/ico;base64,${iconUrl}` }
  }

  return drive.isSystem ? { src: DriveIconSystem } : { src: DriveIcon }
}

const uploadImage = (drive: SimplifiedDrive) => {
  return new Promise<string>((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,.ico'

    input.addEventListener('change', async (e) => {
      e.preventDefault()
      const path = input.files[0].path
      const image = readFileSync(path)

      const write = (buffer: Buffer) => {
        const output = `C:\\picassd\\${nanoid()}.ico`
        if (!existsSync('C:\\picassd')) mkdirSync('C:\\picassd')
        writeFileSync(output, buffer, {
          flag: 'w',
        })

        if (drive.icon.path) {
          try {
            unlinkSync(drive.icon.path)
          } catch (e) {
            console.log('e :>> ', e)
          }
        }

        resolve(output)
      }

      if (path.endsWith('.ico')) write(image)
      else
        toIco(image)
          .then(write)
          .catch((e) => {
            console.error(e)
            alert('Unsupported image. Must be a .png that is 256x256')
          })
    })

    input.click()
  })
}

const App = () => {
  const [drives, setDrives] = useState<SimplifiedDrive[]>([])
  const [driveUpdated, setDriveUpdated] = useState(0)

  const triggerUpdate = () => setDriveUpdated((d) => d + 1)

  useEffect(() => {
    listDrives().then((list) => {
      const driveList: Promise<SimplifiedDrive>[] = []
      list.forEach((d) => {
        d.mountpoints.forEach((m) => {
          driveList.push(
            new Promise<SimplifiedDrive>((resolve) => {
              getIcon(d, m).then((icon) => {
                resolve({
                  letter: getDriveLetter(m),
                  isSystem: d.isSystem,
                  description: d.description,
                  isUSB: d.isUSB,
                  icon,
                })
              })
            })
          )
        })
      })

      Promise.all(driveList).then((drive) => {
        setDrives(
          drive.sort((a, b) => a.letter.charCodeAt(0) - b.letter.charCodeAt(0))
        )
      })
    })
  }, [driveUpdated])

  const changeIcon = async (drive: SimplifiedDrive) => {
    const path = await uploadImage(drive)

    setDriveIcon(drive.letter, path)
    triggerUpdate()
  }
  const revertIcon = (drive: SimplifiedDrive) => {
    IconRegistry.delete(`\\${drive.letter}`)
    try {
      unlinkSync(drive.icon.path)
    } catch (e) {
      console.log('e :>> ', e)
    }
    triggerUpdate()
  }

  const token = useRef<NodeJS.Timer>()

  useEffect(() => {
    token.current = setInterval(() => {
      triggerUpdate()
    }, 1000)

    return () => clearInterval(token.current)
  }, [])

  return (
    <>
      <aside>
        <img src={Logo} alt="Pica-ssd logo" height={200} />
        <ul>
          <li>
            Version:
            <br />
            {pkg.version}
          </li>
          <li>
            <a target="_blank" href="https://github.com/justintaddei/picassd">
              GitHub
            </a>
          </li>
          <li>
            <a
              target="_blank"
              href="https://raw.githubusercontent.com/justintaddei/picassd/master/LICENSE.md"
            >
              License
            </a>
          </li>
        </ul>
        <footer>
          Developed by
          <br />
          <a target="_blank" href="https://justintaddei.com">
            Justin Taddei
          </a>
        </footer>
      </aside>
      <main>
        <ul className="drive-list">
          {drives.map((drive) => (
            <li className="drive" key={drive.letter}>
              <img src={drive.icon.src} alt="" />
              <div>
                <h2>
                  {drive.letter} {drive.isUSB && <small>• USB</small>}
                </h2>
                <p>{drive.description}</p>
              </div>
              <div>
                <button onClick={() => changeIcon(drive)}>Change Icon</button>
                <button className="revert" onClick={() => revertIcon(drive)}>
                  Revert Icon
                </button>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}

export default App
