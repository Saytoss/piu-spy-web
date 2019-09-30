import React from 'react';
import { connect } from 'react-redux';
import { FaLayerGroup, FaFolderOpen, FaSave, FaPlus, FaTrashAlt } from 'react-icons/fa';
import Select from 'react-select';

import Overlay from 'components/Shared/Overlay/Overlay';
import Input from 'components/Shared/Input/Input';

import { loadPresets, savePreset, selectPreset, openPreset, deletePreset } from 'reducers/presets';

const overlayItem = (
  <button className="btn btn-sm btn-dark btn-icon _margin-right">
    <FaLayerGroup />
    пресеты
  </button>
);

const noPresetsMessage = () => 'пусто';

const mapStateToProps = state => {
  return {
    ...state.presets,
  };
};

const mapDispatchToProps = {
  loadPresets,
  savePreset,
  openPreset,
  deletePreset,
  selectPreset,
};

class PresetsControl extends React.Component {
  state = {};

  componentDidMount() {
    this.props.loadPresets();
  }

  onChangeSelection = selected => {
    this.props.selectPreset(selected.name);
  };

  onRewritePreset = () => {
    const { currentPreset } = this.props;
    this.props.savePreset(currentPreset.name);
  };

  onSavePreset = () => {
    const { name } = this.state;
    this.props.savePreset(name);
    this.setState({ isAddingNew: false });
  };

  render() {
    const { presets, currentPreset, isLoading } = this.props;
    const { name, isAddingNew } = this.state;
    return (
      <div>
        <Overlay overlayItem={overlayItem}>
          <div className="presets-control-overlay">
            <Select
              className="select _margin-bottom"
              classNamePrefix="select"
              placeholder="пресеты..."
              options={presets}
              value={currentPreset}
              onChange={this.props.selectPreset}
              noOptionsMessage={noPresetsMessage}
            />
            {currentPreset && (
              <div className="buttons-presets _margin-bottom">
                <div className="_flex-fill" />
                <button
                  className="btn btn-sm btn-dark btn-icon _margin-right"
                  onClick={this.props.openPreset}
                  disabled={isLoading}
                >
                  <FaFolderOpen /> открыть
                </button>
                <button
                  className="btn btn-sm btn-dark btn-icon _margin-right"
                  onClick={this.onRewritePreset}
                  disabled={isLoading}
                >
                  <FaSave /> перезаписать
                </button>
                <button
                  className="btn btn-sm btn-dark btn-icon"
                  onClick={this.props.deletePreset}
                  disabled={isLoading}
                >
                  <FaTrashAlt /> удалить
                </button>
              </div>
            )}
            {!isAddingNew && (
              <div className="buttons-presets _margin-bottom">
                <div className="_flex-fill" />

                <button
                  className="btn btn-sm btn-dark btn-icon _margin-left _self-align-end"
                  onClick={() => this.setState({ isAddingNew: true })}
                  disabled={isLoading}
                >
                  <FaPlus /> добавить
                </button>
              </div>
            )}
            {isAddingNew && (
              <div className="adding-new _margin-bottom">
                <Input
                  value={name}
                  placeholder="имя пресета..."
                  className="form-control"
                  onChange={name => this.setState({ name })}
                />
                <button
                  className="btn btn-sm btn-dark btn-icon _margin-left"
                  onClick={this.onSavePreset}
                  disabled={!name || isLoading}
                >
                  <FaSave /> сохранить
                </button>
                <button
                  className="btn btn-sm btn-dark btn-icon _margin-left"
                  onClick={() => this.setState({ isAddingNew: false })}
                  disabled={isLoading}
                >
                  отмена
                </button>
              </div>
            )}
            {/* <div>
              <Toggle
                checked={false}
                onToggle={active => {
                  localForage.setItem('showTabs', active);
                }}
              >
                показывать табы с пресетами
              </Toggle>
            </div> */}
          </div>
        </Overlay>
      </div>
    );
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PresetsControl);
